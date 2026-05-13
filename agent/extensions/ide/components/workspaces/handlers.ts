import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentWorkspace } from "../../types";
import { notifyMutation } from "../../jj/core";
import {
  forgetWorkspace,
  killTmuxSession,
  createWorkspace,
  generateWorkspaceName,
} from "../../workspace/manager";
import { openEditor } from "../../lib/open-editor";

interface ActionsContext {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  onDone: () => void;
  onSendTask: (task: string) => void;
  cacheDelete: (name: string) => void;
  refresh: () => Promise<void>;
  loadFilesAndDiff: (ws: AgentWorkspace) => Promise<void>;
}

export async function handleAttach(
  ctx: ActionsContext,
  ws: AgentWorkspace,
): Promise<void> {
  ctx.onDone();
  if (process.env.TMUX) {
    await ctx.pi.exec("tmux", ["switch-client", "-t", ws.name]);
    return;
  }
  const terminalResult = await ctx.pi.exec("wezterm", [
    "start",
    "--",
    "tmux",
    "attach",
    "-t",
    ws.name,
  ]);
  if (terminalResult.code !== 0) {
    await ctx.pi.exec("tmux", ["attach", "-t", ws.name]);
  }
}

export function handleRebase(ctx: ActionsContext, ws: AgentWorkspace): void {
  ctx.onDone();
  const task = `Integrate changes from workspace "${ws.name}":
1. List changed files: \`jj diff --summary -r ${ws.name}@\`
2. Review specific files if needed: \`jj diff -r ${ws.name}@ <file>\`
3. Rebase onto current: \`jj rebase -s ${ws.name}@ -d @\`
4. Squash into parent: \`jj squash -r ${ws.name}@\`
5. Set description: \`jj desc -m "type(scope): description"\`
Types: feat, fix, docs, style, refactor, perf, test, chore`;
  ctx.onSendTask(task);
}

export async function handleEdit(
  ctx: ActionsContext,
  ws: AgentWorkspace,
): Promise<void> {
  await openEditor(ctx.pi, ctx.ctx, ws.path);
}

export async function handleTerminal(
  ctx: ActionsContext,
  ws: AgentWorkspace,
): Promise<void> {
  await ctx.pi.exec("terminal", [ws.path]);
}

export async function handleKill(
  ctx: ActionsContext,
  ws: AgentWorkspace,
): Promise<void> {
  await killTmuxSession(ctx.pi, ws.name);
  ctx.cacheDelete(ws.name);
  await ctx.refresh();
}

export async function handleForget(
  ctx: ActionsContext,
  ws: AgentWorkspace,
): Promise<void> {
  await forgetWorkspace(ctx.pi, ws.name);
  ctx.cacheDelete(ws.name);
  await ctx.refresh();
}

export async function handleCreateWorkspace(
  ctx: ActionsContext,
): Promise<void> {
  try {
    const { getRepoRoot } = await import("../../jj/files");
    const { getCurrentChangeId } = await import("../../workspace/manager");
    const repoRootPath = await getRepoRoot(ctx.pi);
    const parentChangeId = await getCurrentChangeId(ctx.pi, repoRootPath);
    const workspaceName = generateWorkspaceName();
    const workspacePath = await createWorkspace(
      ctx.pi,
      workspaceName,
      "New workspace",
      parentChangeId,
    );
    await ctx.pi.exec("wezterm", ["start", "--cwd", workspacePath, "--", "pi"]);
    ctx.cacheDelete(workspaceName);
    await ctx.refresh();
  } catch (error) {
    ctx.pi.sendUserMessage(
      `Error: Failed to create workspace: ${String(error)}`,
    );
  }
}

export async function handleDeleteWorkspace(
  ctx: ActionsContext,
  ws: AgentWorkspace,
  isDefault: boolean,
  isRunning: boolean,
): Promise<void> {
  if (isDefault) return;
  if (isRunning) {
    await killTmuxSession(ctx.pi, ws.name);
  }
  await forgetWorkspace(ctx.pi, ws.name);
  ctx.cacheDelete(ws.name);
  await ctx.refresh();
}

export async function handleDiscardFile(
  ctx: ActionsContext,
  ws: AgentWorkspace,
  filePath: string,
): Promise<void> {
  const { getRepoRoot } = await import("../../jj/files");
  const repoRoot = await getRepoRoot(ctx.pi, ws.path);
  const result = await ctx.pi.exec("jj", ["restore", filePath], {
    cwd: repoRoot,
  });
  ctx.cacheDelete(ws.name);
  await ctx.loadFilesAndDiff(ws);
  notifyMutation(
    ctx.pi,
    `Restored file ${filePath} in workspace ${ws.name}`,
    result.stderr || result.stdout,
  );
}
