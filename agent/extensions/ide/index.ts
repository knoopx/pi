/**
 * IDE Extension
 *
 * Manage pi subagents in isolated jujutsu workspaces.
 *
 * Hooks into /fork to create jj workspaces with subagents.
 *
 * Commands:
 * - /workspaces - Review workspace list and diffs (split view with file panel)
 * - /symbols - Browse symbols and insert path:line references
 * - /files - Browse files and insert path references
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import { formatFileStats } from "./types";
import {
  generateWorkspaceName,
  createWorkspace,
  spawnAgent,
  forkSessionToWorkspace,
  getCurrentChangeId,
  isCurrentChangeEmpty,
  loadAgentWorkspaces,
  cleanupWorkspaceDir,
} from "./workspace";
import { createWorkspacesComponent } from "./components/workspaces-component";
import {
  createSymbolsComponent,
  type SymbolResult,
} from "./components/symbols-component";
import {
  createCmResultsComponent,
  CM_COMMANDS,
  type CmResult,
  type CmActionType,
} from "./components/cm-results-component";
import {
  createFilesComponent,
  type FileResult,
} from "./components/files-component";

import { createChangesComponent } from "./components/changes-component";
import { createBookmarkPromptComponent } from "./components/bookmark-prompt-component";
import { createBookmarksComponent } from "./components/bookmarks-component";
import { createOpLogComponent } from "./components/oplog-component";
import { setBookmarkToChange } from "./jj";

// Common overlay options for full-screen components
const FULL_OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: {
    width: "90%" as const,
    maxHeight: "90%" as const,
    minWidth: 80,
    anchor: "center" as const,
  },
};

async function spawnWorkspaceAgent(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  workspacePath: string,
  workspaceName: string,
  description: string,
  sessionFile: string,
): Promise<void> {
  const forkedSessionPath = forkSessionToWorkspace(sessionFile, workspacePath);

  await spawnAgent(
    pi,
    workspacePath,
    workspaceName,
    description,
    forkedSessionPath,
  );

  if (ctx.hasUI) {
    ctx.ui.notify(
      `Created workspace ${workspaceName} and spawned agent`,
      "info",
    );
  }

  void monitorWorkspace(pi, workspaceName, ctx);
}

export default function ideExtension(pi: ExtensionAPI) {
  async function promptAndSetBookmark(
    ctx: ExtensionContext,
    changeId: string,
  ): Promise<string | null> {
    if (!ctx.hasUI) {
      return null;
    }

    const bookmarkName = await ctx.ui.custom<string | null>(
      (tui, theme, keybindings, done) => {
        return createBookmarkPromptComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          changeId,
          ctx.cwd,
        );
      },
      {
        overlay: true,
        overlayOptions: {
          width: "56%",
          minWidth: 48,
          maxHeight: 10,
          anchor: "center",
        },
      },
    );

    if (!bookmarkName) {
      return null;
    }

    await setBookmarkToChange(pi, ctx.cwd, bookmarkName, changeId);
    return bookmarkName;
  }

  let pendingChangeDescription: string | null = null;

  /**
   * Capture interactive prompt text and defer change creation until tool execution.
   */
  pi.on("input", async (event) => {
    if (event.source !== "interactive") {
      return;
    }

    pendingChangeDescription = event.text.split("\n")[0]?.trim() || null;
  });

  const READONLY_BASH_COMMANDS = new Set([
    "ls",
    "cat",
    "head",
    "tail",
    "grep",
    "rg",
    "find",
    "fd",
    "tree",
    "file",
    "stat",
    "wc",
    "diff",
    "which",
    "type",
    "echo",
    "pwd",
    "env",
    "printenv",
    "date",
    "whoami",
    "hostname",
    "uname",
    "df",
    "du",
    "free",
    "ps",
    "top",
    "htop",
    "jj",
    "git",
    "bat",
    "less",
    "more",
  ]);

  function isReadonlyToolCall(event: {
    toolName: string;
    input?: unknown;
  }): boolean {
    if (event.toolName === "read") {
      return true;
    }

    if (event.toolName === "bash") {
      const input = event.input as { command?: string } | undefined;
      const command = input?.command?.trim() ?? "";
      const firstWord = command.split(/\s+/)[0] ?? "";
      return READONLY_BASH_COMMANDS.has(firstWord);
    }

    return false;
  }

  /**
   * Create a jj change only when the agent actually starts executing a write tool.
   */
  pi.on("tool_call", async (event, ctx) => {
    if (!pendingChangeDescription) {
      return;
    }

    if (isReadonlyToolCall(event)) {
      return;
    }

    try {
      if (await isCurrentChangeEmpty(pi, ctx.cwd)) {
        await pi.exec("jj", ["desc", "-m", pendingChangeDescription], {
          cwd: ctx.cwd,
        });
      } else {
        await pi.exec("jj", ["new", "-m", pendingChangeDescription], {
          cwd: ctx.cwd,
        });
      }
    } catch {
      // Silently fail if jj commands fail (e.g., not a jj repo)
    } finally {
      pendingChangeDescription = null;
    }
  });

  /**
   * Hook into /fork to create a jj workspace and spawn a subagent
   */
  pi.on("session_fork", async (event, ctx) => {
    try {
      // Get current change ID
      const parentChangeId = await getCurrentChangeId(pi, ctx.cwd);

      // Generate workspace name
      const workspaceName = generateWorkspaceName();

      // Get a description from the forked session or use a default
      const description = `Fork from ${event.previousSessionFile || "session"}`;

      // Create the jj workspace
      const workspacePath = await createWorkspace(
        pi,
        workspaceName,
        description,
        parentChangeId,
      );

      // The new session file is already created by /fork
      // We use it directly for the subagent
      const newSessionFile = ctx.sessionManager.getSessionFile();
      if (!newSessionFile) {
        throw new Error("No session file available");
      }

      // Spawn agent in workspace
      await spawnWorkspaceAgent(
        pi,
        ctx,
        workspacePath,
        workspaceName,
        description,
        newSessionFile,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (ctx.hasUI) {
        ctx.ui.notify(`Failed to create workspace on fork: ${msg}`, "error");
      }
    }
  });

  /**
   * /workspace <desc> - Create a workspace and spawn a subagent
   */
  pi.registerCommand("workspace", {
    description:
      "Create a jujutsu workspace and spawn a pi subagent (usage: /workspace <task description>)",
    handler: async (args, ctx) => {
      const description = args.trim();

      if (!description) {
        if (ctx.hasUI) {
          ctx.ui.notify("Usage: /workspace <task description>", "warning");
        }
        return;
      }

      try {
        // Get current change ID
        const parentChangeId = await getCurrentChangeId(pi);

        // Generate workspace name
        const workspaceName = generateWorkspaceName();

        // Create the workspace
        const workspacePath = await createWorkspace(
          pi,
          workspaceName,
          description,
          parentChangeId,
        );

        // Fork the current session to the workspace for context continuity
        const currentSessionFile = ctx.sessionManager.getSessionFile();
        if (!currentSessionFile) {
          throw new Error("No session file available");
        }

        // Spawn agent in workspace
        await spawnWorkspaceAgent(
          pi,
          ctx,
          workspacePath,
          workspaceName,
          description,
          currentSessionFile,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (ctx.hasUI) {
          ctx.ui.notify(`Failed to create workspace: ${msg}`, "error");
        }
      }
    },
  });

  /**
   * /workspaces - Open the review interface
   */
  pi.registerCommand("workspaces", {
    description: "Review ide workspaces and their diffs",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        return;
      }

      await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
        return createWorkspacesComponent(pi, tui, theme, keybindings, done);
      }, FULL_OVERLAY_OPTIONS);
    },
  });

  /**
   * /symbols - Browse and pick symbols from the codebase
   */
  pi.registerCommand("symbols", {
    description:
      "Browse and pick symbols from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openSymbolsPicker(pi, ctx, args.trim());
    },
  });

  /**
   * /files - Browse and pick files from the codebase
   */
  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await openFilesPicker(pi, ctx, args.trim());
    },
  });

  /**
   * /bookmarks - Browse bookmarks and forget selected
   */
  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openBookmarksBrowser(pi, ctx);
    },
  });

  /**
   * /changes - Browse jujutsu changes on current branch with diff preview
   */
  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openChangesBrowser(pi, ctx, promptAndSetBookmark);
    },
  });

  /**
   * /oplog - Browse jujutsu operation log
   */
  pi.registerCommand("oplog", {
    description: "Browse jujutsu operation log with restore capability",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await openOpLogBrowser(pi, ctx);
    },
  });

  /**
   * Ctrl+T shortcut to launch symbol picker
   */
  pi.registerShortcut(Key.ctrl("t"), {
    description: "Open symbol picker",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openSymbolsPicker(pi, ctx, "");
    },
  });

  /**
   * Ctrl+P shortcut to launch file picker
   */
  pi.registerShortcut(Key.ctrl("p"), {
    description: "Open file picker",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openFilesPicker(pi, ctx, "");
    },
  });

  /**
   * Ctrl+B shortcut to open bookmarks browser
   */
  pi.registerShortcut(Key.ctrl("b"), {
    description: "Open bookmarks browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openBookmarksBrowser(pi, ctx);
    },
  });

  /**
   * Ctrl+J shortcut to open workspaces review
   */
  pi.registerShortcut(Key.ctrl("j"), {
    description: "Open workspaces review",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
        return createWorkspacesComponent(pi, tui, theme, keybindings, done);
      }, FULL_OVERLAY_OPTIONS);
    },
  });

  /**
   * Ctrl+K shortcut to open changes browser
   */
  pi.registerShortcut(Key.ctrl("k"), {
    description: "Open changes browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openChangesBrowser(pi, ctx, promptAndSetBookmark);
    },
  });

  /**
   * Ctrl+O shortcut to open op log browser
   */
  pi.registerShortcut(Key.ctrl("o"), {
    description: "Open operation log browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await openOpLogBrowser(pi, ctx);
    },
  });
}

/**
 * Navigation stack for overlay history.
 * Escape pops to previous screen instead of closing all.
 */
type ScreenFactory<T> = (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
) => Promise<{ result: T | null; action?: CmActionType; target?: string }>;

interface NavScreen {
  factory: ScreenFactory<unknown>;
}

/**
 * Run a navigation stack loop. Screens can push new screens via actions,
 * and escape pops back to the previous screen.
 */
async function runNavigationStack<T>(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialScreen: ScreenFactory<T>,
): Promise<T | null> {
  const stack: NavScreen[] = [
    { factory: initialScreen as ScreenFactory<unknown> },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const { result, action, target } = await current.factory(pi, ctx);

    if (result === null) {
      // Escape pressed - pop current screen
      stack.pop();
      continue;
    }

    if (action && target) {
      // Action triggered - push cm results screen
      const cmDef = CM_COMMANDS[action];
      if (cmDef) {
        stack.push({
          factory: async (pi, ctx) => {
            const cmResult = await ctx.ui.custom<CmResult | null>(
              (tui, theme, keybindings, done) =>
                createCmResultsComponent(pi, tui, theme, keybindings, done, {
                  title: cmDef.titleFn(target),
                  command: cmDef.command,
                  args: cmDef.argsFn(target),
                  cwd: ctx.cwd,
                }),
              FULL_OVERLAY_OPTIONS,
            );
            if (!cmResult) return { result: null };
            return {
              result: cmResult.item,
              action: cmResult.action,
              target: cmResult.item.name,
            };
          },
        });
      }
      continue;
    }

    // Final selection - return result and clear stack
    return result as T;
  }

  return null;
}

/**
 * Handler factories to reduce duplication between commands and shortcuts
 */

async function openFilesPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await runNavigationStack(pi, ctx, async (pi, ctx) => {
    const fileResult = await ctx.ui.custom<FileResult | null>(
      (tui, theme, keybindings, done) =>
        createFilesComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          initialQuery,
          ctx.cwd,
        ),
      FULL_OVERLAY_OPTIONS,
    );
    if (!fileResult) return { result: null };
    return {
      result: fileResult.file,
      action: fileResult.action,
      target: fileResult.file.path,
    };
  });

  if (result) {
    const currentText = ctx.ui.getEditorText();
    ctx.ui.setEditorText(currentText + result.path);
  }
}

async function openSymbolsPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await runNavigationStack(pi, ctx, async (pi, ctx) => {
    const symbolResult = await ctx.ui.custom<SymbolResult | null>(
      (tui, theme, keybindings, done) =>
        createSymbolsComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          initialQuery,
          ctx.cwd,
        ),
      FULL_OVERLAY_OPTIONS,
    );
    if (!symbolResult) return { result: null };
    return {
      result: symbolResult.symbol,
      action: symbolResult.action,
      target: symbolResult.symbol.name,
    };
  });

  if (result) {
    const currentText = ctx.ui.getEditorText();
    ctx.ui.setEditorText(currentText + `${result.path}:${result.startLine}`);
  }
}

async function openBookmarksBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom((tui, theme, keybindings, done) => {
    return createBookmarksComponent(
      pi,
      tui,
      theme,
      keybindings,
      done,
      ctx.cwd,
      (text) => {
        ctx.ui.setEditorText(text);
      },
    );
  }, FULL_OVERLAY_OPTIONS);
}

async function openOpLogBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom((tui, theme, keybindings, done) => {
    return createOpLogComponent(
      pi,
      tui,
      theme,
      keybindings,
      done,
      ctx.cwd,
      (message, type = "info") => {
        ctx.ui.notify(message, type);
      },
    );
  }, FULL_OVERLAY_OPTIONS);
}

async function openChangesBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  promptAndSetBookmark: (
    ctx: ExtensionContext,
    changeId: string,
  ) => Promise<string | null>,
): Promise<void> {
  const showChanges = async (): Promise<{
    filePath: string;
    action: CmActionType;
  } | null> => {
    let pendingCmAction: { filePath: string; action: CmActionType } | null =
      null;

    await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
      return createChangesComponent(
        { pi, tui, theme, keybindings, cwd: ctx.cwd },
        done,
        (text) => {
          ctx.ui.setEditorText(text);
        },
        (changeId) => promptAndSetBookmark(ctx, changeId),
        (message, type = "info") => {
          ctx.ui.notify(message, type);
        },
        async (filePath, action) => {
          pendingCmAction = { filePath, action };
          done();
        },
      );
    }, FULL_OVERLAY_OPTIONS);

    return pendingCmAction;
  };

  // Loop to handle cm actions and return to changes
  while (true) {
    const cmAction = await showChanges();

    if (!cmAction) break;

    // Show cm results, then loop back to changes
    const cmDef = CM_COMMANDS[cmAction.action];
    if (cmDef) {
      await ctx.ui.custom<CmResult | null>(
        (tui, theme, keybindings, done) =>
          createCmResultsComponent(pi, tui, theme, keybindings, done, {
            title: cmDef.titleFn(cmAction.filePath),
            command: cmDef.command,
            args: cmDef.argsFn(cmAction.filePath),
            cwd: ctx.cwd,
          }),
        FULL_OVERLAY_OPTIONS,
      );
    }
  }
}

/**
 * Monitor a workspace and notify when the agent completes
 */
async function monitorWorkspace(
  pi: ExtensionAPI,
  workspaceName: string,
  ctx: ExtensionContext,
): Promise<void> {
  const checkInterval = 5000; // 5 seconds
  const maxWait = 3600000; // 1 hour

  const startTime = Date.now();

  const check = async (): Promise<void> => {
    if (Date.now() - startTime > maxWait) {
      return;
    }

    try {
      const workspaces = await loadAgentWorkspaces(pi);
      const ws = workspaces.find((w) => w.name === workspaceName);

      if (!ws) {
        return; // Workspace was deleted
      }

      if (ws.status !== "running") {
        // Agent finished
        const stats = formatFileStats(ws);
        const statusText = ws.status === "completed" ? "completed" : ws.status;

        if (ctx.hasUI) {
          ctx.ui.notify(
            `Agent ${workspaceName} ${statusText} ${stats}`,
            ws.status === "completed" ? "info" : "warning",
          );
        }

        // Send desktop notification
        await pi.exec("notify-send", [
          "-a",
          "IDE",
          `Agent ${statusText}`,
          `${ws.description}\n${stats}`,
        ]);

        // Cleanup workspace directory
        await cleanupWorkspaceDir(pi, workspaceName);

        return;
      }

      // Still running, check again later
      setTimeout(() => void check(), checkInterval);
    } catch {
      // Error checking, try again
      setTimeout(() => void check(), checkInterval);
    }
  };

  // Start checking after initial delay
  setTimeout(() => void check(), checkInterval);
}
