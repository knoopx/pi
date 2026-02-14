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
import type { AgentWorkspace } from "./types";
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
import { createSymbolsComponent } from "./components/symbols-component";
import { createFilesComponent } from "./components/files-component";
import { createChangesComponent } from "./components/changes-component";
import { createBookmarkPromptComponent } from "./components/bookmark-prompt-component";
import { createBookmarksComponent } from "./components/bookmarks-component";
import { setBookmarkToChange } from "./jj";

function formatFileStats(ws: AgentWorkspace): string {
  if (!ws.fileStats) return "";
  const { added, modified, deleted } = ws.fileStats;
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added}`);
  if (modified > 0) parts.push(`~${modified}`);
  if (deleted > 0) parts.push(`-${deleted}`);
  return parts.length > 0 ? `[${parts.join(" ")}]` : "";
}

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
          width: "50%",
          minWidth: 40,
          maxHeight: 8,
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

  /**
   * Always expand tool output
   */
  pi.on("turn_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.setToolsExpanded(true);
    }
  });

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

  /**
   * Create a jj change only when the agent actually starts executing a tool.
   */
  pi.on("tool_call", async (_event, ctx) => {
    if (!pendingChangeDescription) {
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

      await ctx.ui.custom<void>(
        (tui, theme, keybindings, done) => {
          return createWorkspacesComponent(pi, tui, theme, keybindings, done);
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "90%",
            minWidth: 80,
            anchor: "center",
          },
        },
      );
    },
  });

  /**
   * /symbols - Browse and pick symbols from the codebase
   */
  pi.registerCommand("symbols", {
    description:
      "Browse and pick symbols from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        return;
      }

      const result = await ctx.ui.custom<SymbolInfo | null>(
        (tui, theme, keybindings, done) => {
          return createSymbolsComponent(
            pi,
            tui,
            theme,
            keybindings,
            done,
            args.trim(),
            ctx.cwd,
          );
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "90%",
            minWidth: 80,
            anchor: "center",
          },
        },
      );

      if (result) {
        // Append the selected file path:line to the current editor text
        const ref = ` ${result.path}:${result.startLine}`;
        const currentText = ctx.ui.getEditorText();
        ctx.ui.setEditorText(currentText + ref);
      }
    },
  });

  /**
   * /files - Browse and pick files from the codebase
   */
  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) {
        return;
      }

      const result = await ctx.ui.custom<FileInfo | null>(
        (tui, theme, keybindings, done) => {
          return createFilesComponent(
            pi,
            tui,
            theme,
            keybindings,
            done,
            args.trim(),
            ctx.cwd,
          );
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "90%",
            minWidth: 80,
            anchor: "center",
          },
        },
      );

      if (result) {
        const ref = ` ${result.path}`;
        const currentText = ctx.ui.getEditorText();
        ctx.ui.setEditorText(currentText + ref);
      }
    },
  });

  /**
   * /bookmarks - Browse bookmarks and forget selected
   */
  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        return;
      }

      await ctx.ui.custom<void>(
        (tui, theme, keybindings, done) => {
          return createBookmarksComponent(
            pi,
            tui,
            theme,
            keybindings,
            done,
            ctx.cwd,
            (text) => ctx.ui.setEditorText(text),
          );
        },
        {
          overlay: true,
          overlayOptions: {
            width: "70%",
            maxHeight: "90%",
            minWidth: 60,
            anchor: "center",
          },
        },
      );
    },
  });

  /**
   * /changes - Browse jujutsu changes on current branch with diff preview
   */
  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        return;
      }

      await ctx.ui.custom<void>(
        (tui, theme, keybindings, done) => {
          return createChangesComponent(
            pi,
            tui,
            theme,
            keybindings,
            done,
            ctx.cwd,
            (text) => ctx.ui.setEditorText(text),
            (changeId) => promptAndSetBookmark(ctx, changeId),
            (message, type = "info") => ctx.ui.notify(message, type),
          );
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "90%",
            minWidth: 80,
            anchor: "center",
          },
        },
      );
    },
  });

  /**
   * Ctrl+T shortcut to launch symbol picker
   */
  pi.registerShortcut(Key.ctrl("t"), {
    description: "Open symbol picker",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      const result = await ctx.ui.custom<SymbolInfo | null>(
        (tui, theme, keybindings, done) => {
          return createSymbolsComponent(
            pi,
            tui,
            theme,
            keybindings,
            done,
            "",
            ctx.cwd,
          );
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "90%",
            minWidth: 80,
            anchor: "center",
          },
        },
      );

      if (result) {
        const ref = ` ${result.path}:${result.startLine}`;
        const currentText = ctx.ui.getEditorText();
        ctx.ui.setEditorText(currentText + ref);
      }
    },
  });

  /**
   * Ctrl+P shortcut to launch file picker
   */
  pi.registerShortcut(Key.ctrl("p"), {
    description: "Open file picker",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      const result = await ctx.ui.custom<FileInfo | null>(
        (tui, theme, keybindings, done) => {
          return createFilesComponent(
            pi,
            tui,
            theme,
            keybindings,
            done,
            "",
            ctx.cwd,
          );
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "90%",
            minWidth: 80,
            anchor: "center",
          },
        },
      );

      if (result) {
        const ref = ` ${result.path}`;
        const currentText = ctx.ui.getEditorText();
        ctx.ui.setEditorText(currentText + ref);
      }
    },
  });

  /**
   * Ctrl+B shortcut to open bookmarks browser
   */
  pi.registerShortcut(Key.ctrl("b"), {
    description: "Open bookmarks browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      await ctx.ui.custom<void>(
        (tui, theme, keybindings, done) => {
          return createBookmarksComponent(
            pi,
            tui,
            theme,
            keybindings,
            done,
            ctx.cwd,
            (text) => ctx.ui.setEditorText(text),
          );
        },
        {
          overlay: true,
          overlayOptions: {
            width: "70%",
            maxHeight: "90%",
            minWidth: 60,
            anchor: "center",
          },
        },
      );
    },
  });

  /**
   * Ctrl+J shortcut to open workspaces review
   */
  pi.registerShortcut(Key.ctrl("j"), {
    description: "Open workspaces review",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      await ctx.ui.custom<void>(
        (tui, theme, keybindings, done) => {
          return createWorkspacesComponent(pi, tui, theme, keybindings, done);
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "90%",
            minWidth: 80,
            anchor: "center",
          },
        },
      );
    },
  });

  /**
   * Ctrl+K shortcut to open changes browser
   */
  pi.registerShortcut(Key.ctrl("k"), {
    description: "Open changes browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;

      await ctx.ui.custom<void>(
        (tui, theme, keybindings, done) => {
          return createChangesComponent(
            pi,
            tui,
            theme,
            keybindings,
            done,
            ctx.cwd,
            (text) => ctx.ui.setEditorText(text),
            (changeId) => promptAndSetBookmark(ctx, changeId),
            (message, type = "info") => ctx.ui.notify(message, type),
          );
        },
        {
          overlay: true,
          overlayOptions: {
            width: "90%",
            maxHeight: "90%",
            minWidth: 80,
            anchor: "center",
          },
        },
      );
    },
  });
}

interface SymbolInfo {
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
}

interface FileInfo {
  path: string;
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
