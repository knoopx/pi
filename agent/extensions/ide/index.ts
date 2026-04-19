import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Key, type KeyId } from "@mariozechner/pi-tui";

import { createFooter } from "./lib/footer";
import {
  generateWorkspaceName,
  createWorkspace,
  getCurrentChangeId,
} from "./workspace";
import { createWorkspacesComponent } from "./components/workspaces/index";
import { createBookmarkPromptComponent } from "./components/bookmark-prompt";
import { registerAllTools } from "./tools/registration";
import { setBookmarkToChange } from "./jj/bookmarks";

// Overlay imports
import { openFilesPicker } from "./components/files/overlay";
import { openSymbolsPicker } from "./components/symbols/overlay";
import { openBookmarksBrowser } from "./components/bookmarks/overlay";
import { openOpLogBrowser } from "./components/oplog/overlay";
import { openPullRequestsBrowser } from "./components/pull-requests/overlay";
import { openChangesBrowser } from "./components/changes/overlay";
import { openTodosBrowser } from "./components/todos/overlay";
import { monitorWorkspace } from "./workspace";
import { FULL_OVERLAY_OPTIONS } from "./lib/overlay-utils";
import { createNewChange } from "./jj/changes";

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
  const { spawnAgent, forkSessionToWorkspace } = await import("./workspace");

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

  monitorWorkspace(pi, workspaceName, ctx);
}

const promptAndSetBookmark = (
  pi: ExtensionAPI,
): ((ctx: ExtensionContext, changeId: string) => Promise<string | null>) => {
  return async (
    ctx: ExtensionContext,
    changeId: string,
  ): Promise<string | null> => {
    if (!ctx.hasUI) return null;

    const bookmarkName = await ctx.ui.custom<string | null>(
      (tui, _theme, _keybindings, done) => {
        return createBookmarkPromptComponent({
          pi,
          tui,
          theme: _theme,
          done,
          cwd: ctx.cwd,
        });
      },
      {
        overlay: true,
        overlayOptions: {
          width: "56%",
          minWidth: 48,
          maxHeight: 12,
          anchor: "center",
        },
      },
    );

    if (bookmarkName === null) return null;

    await setBookmarkToChange(pi, ctx.cwd, bookmarkName, changeId);
    return bookmarkName;
  };
};

// --- Event handlers ---

function handleSessionStart(pi: ExtensionAPI, ctx: ExtensionContext): void {
  const footer = createFooter(pi, ctx);
  footer.register();
  void footer.refresh();

  void createNewChange(pi, ctx.cwd)
    .then((changeResult) => {
      handleCreateChangeResult(changeResult, ctx);
    })
    .catch(() => {});
}

function notifyChangeResult(opts: {
  success: boolean;
  created: boolean;
  error: string | undefined;
  changeId: string | undefined;
  ui: ExtensionContext["ui"];
}): void {
  if (!opts.success) {
    opts.ui.notify(`Failed to create jj change: ${opts.error}`, "warning");
    return;
  }
  if (opts.created) {
    opts.ui.notify(`New jj change: ${opts.changeId ?? "(no id)"}`, "info");
  }
}

function handleCreateChangeResult(
  changeResult: {
    success: boolean;
    created: boolean;
    error?: string;
    changeId?: string;
  },
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  notifyChangeResult({
    success: changeResult.success,
    created: changeResult.created,
    error: changeResult.error,
    changeId: changeResult.changeId,
    ui: ctx.ui,
  });
}

function handleModelSelect(pi: ExtensionAPI, ctx: ExtensionContext): void {
  const footer = createFooter(pi, ctx);
  footer.register();
  void footer.refresh();
}

function handleSessionFork(
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

function handleWorkspaceCommand(
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
    .catch(() => {});
}

function handleWorkspacesCommand(
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

function handleSymbolsCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openSymbolsPicker(pi, ctx, args);
}

function handleFilesCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openFilesPicker(pi, ctx, args);
}

function handleBookmarksCommand(pi: ExtensionAPI, ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  void openBookmarksBrowser(pi, ctx);
}

function handleChangeCommand(pi: ExtensionAPI, ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  void openChangesBrowser(pi, ctx, (cid) => promptAndSetBookmark(pi)(ctx, cid));
}

function handleOplogCommand(pi: ExtensionAPI, ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  void openOpLogBrowser(pi, ctx);
}

function handlePullRequestsCommand(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openPullRequestsBrowser(pi, ctx);
}

function handleTodosCommand(
  pi: ExtensionAPI,
  args: string,
  ctx: ExtensionContext,
): void {
  if (!ctx.hasUI) return;
  void openTodosBrowser(pi, ctx, args);
}

// --- Registration ---

interface ShortcutDef {
  key: KeyId;
  description: string;
  handler: (ctx: ExtensionContext) => void;
}

function registerShortcuts(pi: ExtensionAPI): void {
  const shortcuts: ShortcutDef[] = [
    {
      key: Key.ctrl("t"),
      description: "Open symbol picker",
      handler: (ctx) => openSymbolsPicker(pi, ctx, ""),
    },
    {
      key: Key.ctrl("p"),
      description: "Open file picker",
      handler: (ctx) => openFilesPicker(pi, ctx, ""),
    },
    {
      key: Key.ctrl("b"),
      description: "Open bookmarks browser",
      handler: (ctx) => openBookmarksBrowser(pi, ctx),
    },
    {
      key: Key.ctrl("j"),
      description: "Open workspaces review",
      handler: async (ctx) => {
        await ctx.ui.custom(
          (tui, theme, keybindings, done) =>
            createWorkspacesComponent({
              pi,
              tui,
              theme,
              keybindings,
              done,
              ctx,
            }),
          FULL_OVERLAY_OPTIONS,
        );
      },
    },
    {
      key: Key.ctrl("k"),
      description: "Open changes browser",
      handler: (ctx) =>
        openChangesBrowser(pi, ctx, (cid) =>
          promptAndSetBookmark(pi)(ctx, cid),
        ),
    },
    {
      key: Key.ctrl("o"),
      description: "Open operation log browser",
      handler: (ctx) => openOpLogBrowser(pi, ctx),
    },
    {
      key: Key.ctrl("g"),
      description: "Open pull requests browser",
      handler: (ctx) => openPullRequestsBrowser(pi, ctx),
    },
  ];

  for (const shortcut of shortcuts) {
    pi.registerShortcut(shortcut.key, {
      description: shortcut.description,
      handler(ctx) {
        if (!ctx.hasUI) return;
        shortcut.handler(ctx);
      },
    });
  }
}

function registerCommands(pi: ExtensionAPI): void {
  pi.registerCommand("workspace", {
    description:
      "Create a jujutsu workspace and spawn a pi subagent (usage: /workspace <task description>)",
    handler: async (args, ctx) => {
      handleWorkspaceCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("workspaces", {
    description: "Review ide workspaces and their diffs",
    handler: async (_args, ctx) => {
      handleWorkspacesCommand(pi, ctx);
    },
  });

  pi.registerCommand("symbols", {
    description:
      "Browse and pick symbols from the codebase with source preview",
    handler: async (args, ctx) => {
      handleSymbolsCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    handler: async (args, ctx) => {
      handleFilesCommand(pi, args, ctx);
    },
  });

  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    handler: async (_args, ctx) => {
      handleBookmarksCommand(pi, ctx);
    },
  });

  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    handler: async (_args, ctx) => {
      handleChangeCommand(pi, ctx);
    },
  });

  pi.registerCommand("oplog", {
    description: "Browse jujutsu operation log with restore capability",
    handler: async (_args, ctx) => {
      handleOplogCommand(pi, ctx);
    },
  });

  pi.registerCommand("pull-requests", {
    description: "Browse GitHub pull requests with diff preview",
    handler: async (_args, ctx) => {
      handlePullRequestsCommand(pi, ctx);
    },
  });

  pi.registerCommand("todos", {
    description:
      "Search for task comments across the codebase with source preview",
    handler: async (args, ctx) => {
      handleTodosCommand(pi, args, ctx);
    },
  });
}

export default function ideExtension(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    handleSessionStart(pi, ctx);
  });
  pi.on("model_select", (_event, ctx) => {
    handleModelSelect(pi, ctx);
  });
  pi.on("session_before_fork", (_event, ctx) => {
    handleSessionFork(pi, _event, ctx);
  });

  registerShortcuts(pi);
  registerCommands(pi);
  registerAllTools(pi);
}
