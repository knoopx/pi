import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import {
  generateWorkspaceName,
  createWorkspace,
  getCurrentChangeId,
} from "./manager";
import { createWorkspacesComponent } from "../components/workspaces/component";
import { FULL_OVERLAY_OPTIONS } from "../lib/ui/overlay";

function reportWorkspaceError(ctx: ExtensionContext, msg: string): void {
  if (ctx.hasUI) ctx.ui.notify(msg, "error");
}

async function spawnWorkspaceAgent(options: {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  workspacePath: string;
  workspaceName: string;
  description: string;
  sessionFile: string;
}): Promise<void> {
  const { pi, ctx, workspacePath, workspaceName, description, sessionFile } =
    options;
  const { spawnAgent, forkSessionToWorkspace } = await import("./manager");
  const newSessionFile = forkSessionToWorkspace(sessionFile, workspacePath);

  await spawnAgent({
    pi,
    workspacePath,
    sessionName: workspaceName,
    task: description,
    forkedSessionPath: newSessionFile,
  });

  if (ctx.hasUI)
    ctx.ui.notify(`Spawned agent in workspace ${workspaceName}`, "info");

  const { monitorWorkspace } = await import("./manager");
  monitorWorkspace(pi, workspaceName, ctx);
}

export function handleSessionFork(
  pi: ExtensionAPI,
  _event: { entryId: string },
  ctx: ExtensionContext,
): void {
  const workspaceName = generateWorkspaceName();
  const description = "Forked session";

  getCurrentChangeId(pi, ctx.cwd)
    .then((parentChangeId) => {
      if (!parentChangeId) return;
      return createWorkspace(pi, workspaceName, description, parentChangeId);
    })
    .then((workspacePath) => {
      if (!workspacePath) return;
      const newSessionFile = ctx.sessionManager.getSessionFile();
      if (!newSessionFile) return;
      return spawnWorkspaceAgent({
        pi,
        ctx,
        workspacePath,
        workspaceName,
        description,
        sessionFile: newSessionFile,
      });
    })
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      reportWorkspaceError(ctx, `Failed to create workspace on fork: ${msg}`);
    });
}

export function handleWorkspaceCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  const description = args.trim();
  if (description.length === 0) {
    if (ctx.hasUI)
      ctx.ui.notify("Usage: /workspace <task description>", "warning");
    return;
  }

  void getCurrentChangeId(pi)
    .then((parentChangeId) =>
      createWorkspace(pi, generateWorkspaceName(), description, parentChangeId)
        .then((workspacePath) => {
          const currentSessionFile = ctx.sessionManager.getSessionFile();
          if (!currentSessionFile) return;
          return spawnWorkspaceAgent({
            pi,
            ctx,
            workspacePath,
            workspaceName: generateWorkspaceName(),
            description,
            sessionFile: currentSessionFile,
          });
        })
        .catch((error) => {
          const msg = error instanceof Error ? error.message : String(error);
          reportWorkspaceError(ctx, `Failed to create workspace: ${msg}`);
        }),
    )
    .catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Workspace setup failed: ${msg}`, "warning");
    });
}

export function handleWorkspacesCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void ctx.ui.custom(
    (tui, theme, keybindings, done) =>
      createWorkspacesComponent({ pi, tui, theme, keybindings, done, ctx }),
    FULL_OVERLAY_OPTIONS,
  );
}
