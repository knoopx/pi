/**
 * Command registration for IDE extension.
 *
 * Extracts command handlers from index.ts for better separation of concerns.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createWorkspacesComponent } from "../components/workspaces";
import {
  generateWorkspaceName,
  createWorkspace,
  getCurrentChangeId,
} from "../workspace";

// Common overlay options for full-screen components
const FULL_OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: {
    width: "95%" as const,
    anchor: "center" as const,
  },
};

export interface CommandHandlers {
  openFilesPicker: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    query: string,
  ) => Promise<void>;
  openSymbolsPicker: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    query: string,
  ) => Promise<void>;
  openBookmarksBrowser: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
  ) => Promise<void>;
  openChangesBrowser: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    promptAndSetBookmark: (
      ctx: ExtensionContext,
      changeId: string,
      cwd: string,
    ) => Promise<void>,
  ) => Promise<void>;
  openOpLogBrowser: (pi: ExtensionAPI, ctx: ExtensionContext) => Promise<void>;
  openSkillBrowser: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    query: string,
  ) => Promise<void>;
  openPullRequestsBrowser: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
  ) => Promise<void>;
  openLinearIssuesBrowser: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
  ) => Promise<void>;
  openCommandPalette: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    shortcuts: Array<{
      shortcut: unknown;
      description?: string;
      execute: () => void;
    }>,
  ) => Promise<void>;
  spawnWorkspaceAgent: (
    pi: ExtensionAPI,
    ctx: ExtensionContext,
    workspacePath: string,
    workspaceName: string,
    description: string,
    sessionFile: string,
  ) => Promise<void>;
}

export function registerCommands(
  pi: ExtensionAPI,
  handlers: CommandHandlers,
  promptAndSetBookmark: (
    ctx: ExtensionContext,
    changeId: string,
    cwd: string,
  ) => Promise<void>,
): void {
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
        const parentChangeId = await getCurrentChangeId(pi);
        const workspaceName = generateWorkspaceName();
        const workspacePath = await createWorkspace(
          pi,
          workspaceName,
          description,
          parentChangeId,
        );

        const currentSessionFile = ctx.sessionManager.getSessionFile();
        if (!currentSessionFile) {
          throw new Error("No session file available");
        }

        await handlers.spawnWorkspaceAgent(
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
      if (!ctx.hasUI) return;

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
      await handlers.openSymbolsPicker(pi, ctx, args.trim());
    },
  });

  /**
   * /files - Browse and pick files from the codebase
   */
  pi.registerCommand("files", {
    description: "Browse and pick files from the codebase with source preview",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openFilesPicker(pi, ctx, args.trim());
    },
  });

  /**
   * /bookmarks - Browse bookmarks and forget selected
   */
  pi.registerCommand("bookmarks", {
    description: "Browse bookmarks (name@remote), insert, refresh, and forget",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openBookmarksBrowser(pi, ctx);
    },
  });

  /**
   * /changes - Browse jujutsu changes on current branch with diff preview
   */
  pi.registerCommand("changes", {
    description: "Browse jujutsu changes on current branch with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openChangesBrowser(pi, ctx, promptAndSetBookmark);
    },
  });

  /**
   * /oplog - Browse jujutsu operation log
   */
  pi.registerCommand("oplog", {
    description: "Browse jujutsu operation log with restore capability",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openOpLogBrowser(pi, ctx);
    },
  });

  /**
   * /skills - Browse and install skills
   */
  pi.registerCommand("skills", {
    description: "Browse local skills and install from skills.sh",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openSkillBrowser(pi, ctx, args.trim());
    },
  });

  /**
   * /pull-requests - Browse GitHub pull requests
   */
  pi.registerCommand("pull-requests", {
    description: "Browse GitHub pull requests with diff preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openPullRequestsBrowser(pi, ctx);
    },
  });

  /**
   * /linear - Browse Linear issues
   */
  pi.registerCommand("linear", {
    description: "Browse Linear issues with markdown preview",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openLinearIssuesBrowser(pi, ctx);
    },
  });
}
