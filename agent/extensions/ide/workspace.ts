import {
  type ExtensionAPI,
  type ExtensionContext,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import type {
  AgentWorkspace,
  WorkspaceStatus,
  WorkspaceListEntry,
  DiffStats,
} from "./lib/types";
import { getRepoRoot } from "./jj/files";
import { sanitizeDescription, updateStaleWorkspace } from "./jj/core";
import { formatFileStats } from "./lib/formatters";

const WORKSPACE_PREFIX = "ide-";
const CHECK_INTERVAL = 5000;
const MAX_WAIT = 3600000;

export function generateWorkspaceName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${WORKSPACE_PREFIX}${timestamp}-${random}`;
}

function isIdeWorkspace(name: string): boolean {
  return name.startsWith(WORKSPACE_PREFIX);
}

export async function getCurrentChangeId(
  pi: ExtensionAPI,
  cwd?: string,
): Promise<string> {
  await updateStaleWorkspace(pi, cwd);

  const args = ["log", "-r", "@", "--no-graph", "-T", "change_id"];
  const result = await pi.exec("jj", args, cwd ? { cwd } : undefined);
  if (result.code !== 0)
    throw new Error(`Failed to get current change ID: ${result.stderr}`);
  return result.stdout.trim();
}

export function parseWorkspaceList(output: string): WorkspaceListEntry[] {
  const entries: WorkspaceListEntry[] = [];
  const lines = output.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    const match = /^(\S+):\s+(\w+)\s*(.*)?$/.exec(line);
    if (match)
      entries.push({
        name: match[1],
        changeId: match[2],
        description: sanitizeDescription(match[3]?.trim() || ""),
      });
  }

  return entries;
}

async function listWorkspaces(pi: ExtensionAPI): Promise<WorkspaceListEntry[]> {
  const result = await pi.exec("jj", ["workspace", "list"]);
  if (result.code !== 0)
    throw new Error(`Failed to list workspaces: ${result.stderr}`);
  return parseWorkspaceList(result.stdout);
}

export async function createWorkspace(
  pi: ExtensionAPI,
  name: string,
  description: string,
  parentChangeId: string,
): Promise<string> {
  const repoRoot = await getRepoRoot(pi);
  const workspacesDir = `${repoRoot}/.jj/workspaces`;
  const workspacePath = `${workspacesDir}/${name}`;
  await pi.exec("mkdir", ["-p", workspacesDir]);
  const result = await pi.exec("jj", [
    "workspace",
    "add",
    workspacePath,
    "--name",
    name,
    "-r",
    parentChangeId,
    "-m",
    description,
  ]);

  if (result.code !== 0)
    throw new Error(`Failed to create workspace: ${result.stderr}`);

  return workspacePath;
}

async function getDiffStats(
  pi: ExtensionAPI,
  workspacePath: string,
): Promise<DiffStats> {
  const result = await pi.exec("jj", ["diff", "--stat", "-r", "@"], {
    cwd: workspacePath,
  });

  if (result.code !== 0)
    return { files: [], totalInsertions: 0, totalDeletions: 0 };

  return parseDiffStats(result.stdout);
}

export function parseDiffStats(output: string): DiffStats {
  const files: DiffStats["files"] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  const lines = output.trim().split("\n");
  for (const line of lines) {
    // Match file lines like: "src/file.ts | 10 +++++-----"
    const fileMatch = /^\s*(.+?)\s*\|\s*(\d+)\s*([+-]*)\s*$/.exec(line);
    if (fileMatch) {
      const path = fileMatch[1].trim();
      const insertions = (fileMatch[3].match(/\+/g) || []).length;
      const deletions = (fileMatch[3].match(/-/g) || []).length;

      let status: "added" | "modified" | "deleted" = "modified";
      if (deletions === 0 && insertions > 0) status = "added";
      if (insertions === 0 && deletions > 0) status = "deleted";

      files.push({ path, status, insertions, deletions });
      totalInsertions += insertions;
      totalDeletions += deletions;
    }
  }

  return { files, totalInsertions, totalDeletions };
}

async function tmuxSessionExists(
  pi: ExtensionAPI,
  sessionName: string,
): Promise<boolean> {
  const result = await pi.exec("tmux", ["has", "-t", sessionName]);
  return result.code === 0;
}

export async function getTmuxSessionStatus(
  pi: ExtensionAPI,
  sessionName: string,
): Promise<WorkspaceStatus> {
  const exists = await tmuxSessionExists(pi, sessionName);
  if (!exists) return "completed";
  const result = await pi.exec("tmux", [
    "list-panes",
    "-t",
    sessionName,
    "-F",
    "#{pane_current_command}",
  ]);

  if (result.code !== 0) return "idle";

  const command = result.stdout.trim();
  // If pi or node is running, agent is active
  if (
    command.includes("pi") ||
    command.includes("node") ||
    command.includes("bun")
  )
    return "running";

  return "idle";
}

/**
 * Fork the current session to a workspace directory.
 * This allows the subagent to continue with the full conversation context.
 *
 * @param sourceSessionPath Path to the current session file
 * @param workspacePath Path to the workspace directory (new cwd for subagent)
 * @returns Path to the forked session file, or undefined if source is ephemeral
 */
export function forkSessionToWorkspace(
  sourceSessionPath: string | undefined,
  workspacePath: string,
): string | undefined {
  if (!sourceSessionPath) {
    // No session to fork (ephemeral session)
    return undefined;
  }

  try {
    // Fork the session to the workspace directory
    // The forked session will have parentSession pointing to the original
    const forkedSession = SessionManager.forkFrom(
      sourceSessionPath,
      workspacePath,
    );
    return forkedSession.getSessionFile();
  } catch {
    // Source session is empty or invalid - create a fresh session instead
    const newSession = SessionManager.create(workspacePath);
    return newSession.getSessionFile();
  }
}

/**
 * Spawn a pi subagent in a tmux session with session context
 *
 * @param pi Extension API
 * @param workspacePath Path to the workspace directory
 * @param sessionName Tmux session name (also workspace name)
 * @param task Task description to send to the agent
 * @param forkedSessionPath Optional path to a forked session file for context
 */
export async function spawnAgent(options: {
  pi: ExtensionAPI;
  workspacePath: string;
  sessionName: string;
  task: string;
  forkedSessionPath?: string;
}): Promise<void> {
  const { pi, workspacePath, sessionName, task, forkedSessionPath } = options;
  let piCmd = "pi";
  if (forkedSessionPath) piCmd += ` --session "${forkedSessionPath}"`;

  const escapedTask = task.replace(/"/g, '\\"');
  piCmd += ` "${escapedTask}"`;
  const result = await pi.exec("tmux", [
    "new-session",
    "-d",
    "-s",
    sessionName,
    "-c",
    workspacePath,
    "bash",
    "-c",
    piCmd,
  ]);

  if (result.code !== 0)
    throw new Error(`Failed to spawn agent: ${result.stderr}`);
}

export async function killTmuxSession(
  pi: ExtensionAPI,
  sessionName: string,
): Promise<void> {
  await pi.exec("tmux", ["kill-session", "-t", sessionName]);
}

export async function loadAgentWorkspaces(
  pi: ExtensionAPI,
): Promise<AgentWorkspace[]> {
  const workspaces = await listWorkspaces(pi);
  const ideWorkspaces = workspaces.filter((w) => isIdeWorkspace(w.name));
  const repoRoot = await getRepoRoot(pi);

  const result: AgentWorkspace[] = [];

  for (const ws of ideWorkspaces) {
    const workspacePath = `${repoRoot}/.jj/workspaces/${ws.name}`;
    const status = await getTmuxSessionStatus(pi, ws.name);
    const diffStats = await getDiffStats(pi, workspacePath);

    result.push({
      name: ws.name,
      path: workspacePath,
      description: ws.description,
      status,
      changeId: ws.changeId,
      parentChangeId: "", // Would need to track this separately
      createdAt: Date.now(), // Would need to track this separately
      fileStats: {
        added: diffStats.files.filter((f) => f.status === "added").length,
        modified: diffStats.files.filter((f) => f.status === "modified").length,
        deleted: diffStats.files.filter((f) => f.status === "deleted").length,
      },
    });
  }

  return result;
}

async function cleanupWorkspaceDir(
  pi: ExtensionAPI,
  workspaceName: string,
): Promise<void> {
  const repoRoot = await getRepoRoot(pi);
  const workspacePath = `${repoRoot}/.jj/workspaces/${workspaceName}`;
  await pi.exec("rm", ["-rf", workspacePath]);
}

export async function forgetWorkspace(
  pi: ExtensionAPI,
  workspaceName: string,
): Promise<void> {
  // Kill tmux session if running
  await killTmuxSession(pi, workspaceName);

  const result = await pi.exec("jj", ["workspace", "forget", workspaceName]);
  if (result.code !== 0)
    throw new Error(`Failed to forget workspace: ${result.stderr}`);

  await cleanupWorkspaceDir(pi, workspaceName);
}

export function monitorWorkspace(
  pi: ExtensionAPI,
  workspaceName: string,
  ctx: ExtensionContext,
): void {
  const startTime = Date.now();

  const check = async (): Promise<void> => {
    if (Date.now() - startTime > MAX_WAIT) return;

    try {
      const workspaces = await loadAgentWorkspaces(pi);
      const ws = workspaces.find((w) => w.name === workspaceName);

      if (!ws) return;
      if (ws.status === "running") {
        scheduleNextCheck(check);
        return;
      }

      await handleCompletedWorkspace(pi, ctx, workspaceName, ws);
    } catch {
      scheduleNextCheck(check);
    }
  };

  setTimeout(() => void check(), CHECK_INTERVAL);
}

function scheduleNextCheck(check: () => Promise<void>): void {
  setTimeout(() => void check(), CHECK_INTERVAL);
}

function formatStatusText(status: string): string {
  return status === "completed" ? "completed" : status;
}

async function handleCompletedWorkspace(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  workspaceName: string,
  ws: Awaited<ReturnType<typeof loadAgentWorkspaces>>[number],
): Promise<void> {
  const stats = formatFileStats(ws);
  const statusText = formatStatusText(ws.status);

  if (ctx.hasUI) {
    ctx.ui.notify(
      `Agent ${workspaceName} ${statusText} ${stats}`,
      ws.status === "completed" ? "info" : "warning",
    );
  }

  await pi.exec("notify-send", [
    "-a",
    "IDE",
    `Agent ${statusText}`,
    `${ws.description}\n${stats}`,
  ]);
}
