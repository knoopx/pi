import {
  type ExtensionAPI,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import type {
  AgentWorkspace,
  WorkspaceStatus,
  WorkspaceListEntry,
  DiffStats,
} from "./types";
import { updateStaleWorkspace, sanitizeDescription } from "./jj";

const WORKSPACE_PREFIX = "ide-";

/**
 * Generate a unique workspace name
 */
export function generateWorkspaceName(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${WORKSPACE_PREFIX}${timestamp}-${random}`;
}

/**
 * Check if a workspace name is an ide workspace
 */
function isIdeWorkspace(name: string): boolean {
  return name.startsWith(WORKSPACE_PREFIX);
}

/**
 * Get the root repository path
 */
export async function getRepoRoot(pi: ExtensionAPI): Promise<string> {
  const result = await pi.exec("jj", ["workspace", "root"]);
  if (result.code !== 0) {
    throw new Error(`Failed to get repo root: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/**
 * Get the current change ID
 */
export async function getCurrentChangeId(
  pi: ExtensionAPI,
  cwd?: string,
): Promise<string> {
  // Update stale working copy first to avoid errors
  await updateStaleWorkspace(pi, cwd);

  const args = ["log", "-r", "@", "--no-graph", "-T", "change_id"];
  const result = await pi.exec("jj", args, cwd ? { cwd } : undefined);
  if (result.code !== 0) {
    throw new Error(`Failed to get current change ID: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/**
 * Parse jj workspace list output
 */
export function parseWorkspaceList(output: string): WorkspaceListEntry[] {
  const entries: WorkspaceListEntry[] = [];
  const lines = output.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    // Format: "name: changeId description"
    const match = /^(\S+):\s+(\w+)\s*(.*)?$/.exec(line);
    if (match) {
      entries.push({
        name: match[1],
        changeId: match[2],
        description: sanitizeDescription(match[3]?.trim() || ""),
      });
    }
  }

  return entries;
}

/**
 * List all jujutsu workspaces
 */
async function listWorkspaces(pi: ExtensionAPI): Promise<WorkspaceListEntry[]> {
  const result = await pi.exec("jj", ["workspace", "list"]);
  if (result.code !== 0) {
    throw new Error(`Failed to list workspaces: ${result.stderr}`);
  }
  return parseWorkspaceList(result.stdout);
}

/**
 * Create a new jujutsu workspace
 */
export async function createWorkspace(
  pi: ExtensionAPI,
  name: string,
  description: string,
  parentChangeId: string,
): Promise<string> {
  const repoRoot = await getRepoRoot(pi);
  const workspacesDir = `${repoRoot}/.jj/workspaces`;
  const workspacePath = `${workspacesDir}/${name}`;

  // Ensure workspaces directory exists
  await pi.exec("mkdir", ["-p", workspacesDir]);

  // Create workspace from current change
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

  if (result.code !== 0) {
    throw new Error(`Failed to create workspace: ${result.stderr}`);
  }

  return workspacePath;
}

/**
 * Get diff stats for a workspace compared to its parent
 */
async function getDiffStats(
  pi: ExtensionAPI,
  workspacePath: string,
): Promise<DiffStats> {
  const result = await pi.exec("jj", ["diff", "--stat", "-r", "@"], {
    cwd: workspacePath,
  });

  if (result.code !== 0) {
    return { files: [], totalInsertions: 0, totalDeletions: 0 };
  }

  return parseDiffStats(result.stdout);
}

/**
 * Parse jj diff --stat output
 */
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

/**
 * Check if a tmux session exists
 */
async function tmuxSessionExists(
  pi: ExtensionAPI,
  sessionName: string,
): Promise<boolean> {
  const result = await pi.exec("tmux", ["has", "-t", sessionName]);
  return result.code === 0;
}

/**
 * Get tmux session status
 */
export async function getTmuxSessionStatus(
  pi: ExtensionAPI,
  sessionName: string,
): Promise<WorkspaceStatus> {
  const exists = await tmuxSessionExists(pi, sessionName);
  if (!exists) {
    return "completed";
  }

  // Check if the pi process is still running in the session
  const result = await pi.exec("tmux", [
    "list-panes",
    "-t",
    sessionName,
    "-F",
    "#{pane_current_command}",
  ]);

  if (result.code !== 0) {
    return "idle";
  }

  const command = result.stdout.trim();
  // If pi or node is running, agent is active
  if (
    command.includes("pi") ||
    command.includes("node") ||
    command.includes("bun")
  ) {
    return "running";
  }

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
export async function spawnAgent(
  pi: ExtensionAPI,
  workspacePath: string,
  sessionName: string,
  task: string,
  forkedSessionPath?: string,
): Promise<void> {
  // Build pi command with optional session
  let piCmd = "pi";
  if (forkedSessionPath) {
    piCmd += ` --session "${forkedSessionPath}"`;
  }

  // Pass the task as a command line argument to make it non-interactive
  const escapedTask = task.replace(/"/g, '\\"');
  piCmd += ` "${escapedTask}"`;

  // Create tmux session and run pi with the task as argument
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

  if (result.code !== 0) {
    throw new Error(`Failed to spawn agent: ${result.stderr}`);
  }
}

/**
 * Kill a tmux session
 */
export async function killTmuxSession(
  pi: ExtensionAPI,
  sessionName: string,
): Promise<void> {
  await pi.exec("tmux", ["kill-session", "-t", sessionName]);
}

/**
 * Load all ide workspaces with their status
 */
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

/**
 * Remove the workspace directory
 */
async function cleanupWorkspaceDir(
  pi: ExtensionAPI,
  workspaceName: string,
): Promise<void> {
  const repoRoot = await getRepoRoot(pi);
  const workspacePath = `${repoRoot}/.jj/workspaces/${workspaceName}`;
  await pi.exec("rm", ["-rf", workspacePath]);
}

/**
 * Forget (delete) a jujutsu workspace
 */
export async function forgetWorkspace(
  pi: ExtensionAPI,
  workspaceName: string,
): Promise<void> {
  // Kill tmux session if running
  await killTmuxSession(pi, workspaceName);

  // Forget the workspace in jj
  const result = await pi.exec("jj", ["workspace", "forget", workspaceName]);
  if (result.code !== 0) {
    throw new Error(`Failed to forget workspace: ${result.stderr}`);
  }

  // Remove the workspace directory
  await cleanupWorkspaceDir(pi, workspaceName);
}
