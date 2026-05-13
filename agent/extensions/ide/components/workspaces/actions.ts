import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { AgentWorkspace } from "../../types";
import type { WorkspaceState, WorkspaceCacheStore } from "./loading";
import { formatErrorMessage } from "../../lib/ui/footer";
import {
  handleAttach,
  handleRebase,
  handleEdit,
  handleTerminal,
  handleKill,
  handleForget,
  handleCreateWorkspace,
  handleDeleteWorkspace,
  handleDiscardFile,
} from "./handlers";

export interface WorkspaceActionsContext {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  state: WorkspaceState;
  cacheStore: WorkspaceCacheStore;
  onDone: () => void;
  onSendTask: (task: string) => void;
  refresh: () => Promise<void>;
  loadFilesAndDiff: (ws: AgentWorkspace) => Promise<void>;
  invalidate: () => void;
}

export async function executeAction(
  ctx: WorkspaceActionsContext,
  action: string,
): Promise<void> {
  if (!ctx.state.selectedWorkspace) return;
  try {
    await handleWorkspaceAction(ctx, action, ctx.state.selectedWorkspace);
  } catch (error) {
    const msg = formatErrorMessage(error);
    ctx.state.diffContent = [`Error: ${msg}`];
  }
  ctx.invalidate();
}

async function handleWorkspaceAction(
  ctx: WorkspaceActionsContext,
  action: string,
  ws: AgentWorkspace,
): Promise<void> {
  const actionsCtx = getActionsContext(ctx);
  const handlers: Record<string, () => void | Promise<void>> = {
    attach: () => handleAttach(actionsCtx, ws),
    rebase: () => handleRebase(actionsCtx, ws),
    edit: () => handleEdit(actionsCtx, ws),
    terminal: () => handleTerminal(actionsCtx, ws),
    kill: () => handleKill(actionsCtx, ws),
    forget: () => handleForget(actionsCtx, ws),
  };
  const handler = handlers[action];
  if (handler) await handler();
}

function getActionsContext(ctx: WorkspaceActionsContext) {
  return {
    pi: ctx.pi,
    ctx: ctx.ctx,
    onDone: ctx.onDone,
    onSendTask: ctx.onSendTask,
    cacheDelete: (name: string) => ctx.cacheStore.delete(name),
    refresh: ctx.refresh,
    loadFilesAndDiff: ctx.loadFilesAndDiff,
  };
}

export async function createNewWorkspace(
  ctx: WorkspaceActionsContext,
): Promise<void> {
  await handleCreateWorkspace(getActionsContext(ctx));
}

export async function deleteWorkspace(
  ctx: WorkspaceActionsContext,
  isDefaultWs: boolean,
  isRunningWs: boolean,
): Promise<void> {
  if (!ctx.state.selectedWorkspace || isDefaultWs) return;
  await handleDeleteWorkspace(
    getActionsContext(ctx),
    ctx.state.selectedWorkspace,
    isDefaultWs,
    isRunningWs,
  );
}

export async function discardFile(
  ctx: WorkspaceActionsContext,
  canDiscard: boolean,
): Promise<void> {
  if (!canDiscard) return;
  const file = ctx.state.files[ctx.state.fileIndex];
  const ws = ctx.state.selectedWorkspace;
  if (!ws) return;
  await handleDiscardFile(getActionsContext(ctx), ws, file.path);
}
