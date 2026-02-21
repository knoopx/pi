/**
 * Keyboard shortcut registration for IDE extension.
 *
 * Extracts shortcut handlers from index.ts for better separation of concerns.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import type { KeyId } from "@mariozechner/pi-tui";
import { createWorkspacesComponent } from "../components/workspaces";
import type { CommandHandlers } from "../commands";

// Common overlay options for full-screen components
const FULL_OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: {
    width: "95%" as const,
    anchor: "center" as const,
  },
};

export interface RegisteredShortcut {
  shortcut: KeyId;
  description?: string;
  execute: () => void;
}

export function registerShortcuts(
  pi: ExtensionAPI,
  handlers: CommandHandlers,
  promptAndSetBookmark: (
    ctx: ExtensionContext,
    changeId: string,
    cwd: string,
  ) => Promise<void>,
): RegisteredShortcut[] {
  // Track current context for command palette execution
  let currentCtx: ExtensionContext | null = null;

  /**
   * Ctrl+T shortcut to launch symbol picker
   */
  pi.registerShortcut(Key.ctrl("t"), {
    description: "Open symbol picker",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openSymbolsPicker(pi, ctx, "");
    },
  });

  /**
   * Ctrl+P shortcut to launch file picker
   */
  pi.registerShortcut(Key.ctrl("p"), {
    description: "Open file picker",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openFilesPicker(pi, ctx, "");
    },
  });

  /**
   * Ctrl+B shortcut to open bookmarks browser
   */
  pi.registerShortcut(Key.ctrl("b"), {
    description: "Open bookmarks browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openBookmarksBrowser(pi, ctx);
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
      await handlers.openChangesBrowser(pi, ctx, promptAndSetBookmark);
    },
  });

  /**
   * Ctrl+O shortcut to open op log browser
   */
  pi.registerShortcut(Key.ctrl("o"), {
    description: "Open operation log browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openOpLogBrowser(pi, ctx);
    },
  });

  /**
   * Ctrl+S shortcut to open skill browser
   */
  pi.registerShortcut(Key.ctrl("s"), {
    description: "Open skill browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openSkillBrowser(pi, ctx, "");
    },
  });

  /**
   * Ctrl+G shortcut to open pull requests browser
   */
  pi.registerShortcut(Key.ctrl("g"), {
    description: "Open pull requests browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openPullRequestsBrowser(pi, ctx);
    },
  });

  /**
   * Ctrl+U shortcut to open Linear issues browser
   */
  pi.registerShortcut(Key.ctrl("u"), {
    description: "Open Linear issues browser",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      await handlers.openLinearIssuesBrowser(pi, ctx);
    },
  });

  // Build registered shortcuts list for command palette
  const registeredShortcuts: RegisteredShortcut[] = [
    {
      shortcut: Key.ctrl("t"),
      description: "Open symbol picker",
      execute: () => {
        if (currentCtx) {
          void handlers.openSymbolsPicker(pi, currentCtx, "");
        }
      },
    },
    {
      shortcut: Key.ctrl("p"),
      description: "Open file picker",
      execute: () => {
        if (currentCtx) {
          void handlers.openFilesPicker(pi, currentCtx, "");
        }
      },
    },
    {
      shortcut: Key.ctrl("b"),
      description: "Open bookmarks browser",
      execute: () => {
        if (currentCtx) {
          void handlers.openBookmarksBrowser(pi, currentCtx);
        }
      },
    },
    {
      shortcut: Key.ctrl("j"),
      description: "Open workspaces review",
      execute: () => {
        if (currentCtx) {
          void currentCtx.ui.custom<void>((tui, theme, keybindings, done) => {
            return createWorkspacesComponent(pi, tui, theme, keybindings, done);
          }, FULL_OVERLAY_OPTIONS);
        }
      },
    },
    {
      shortcut: Key.ctrl("k"),
      description: "Open changes browser",
      execute: () => {
        if (currentCtx) {
          void handlers.openChangesBrowser(
            pi,
            currentCtx,
            promptAndSetBookmark,
          );
        }
      },
    },
    {
      shortcut: Key.ctrl("o"),
      description: "Open operation log browser",
      execute: () => {
        if (currentCtx) {
          void handlers.openOpLogBrowser(pi, currentCtx);
        }
      },
    },
    {
      shortcut: Key.ctrl("s"),
      description: "Open skill browser",
      execute: () => {
        if (currentCtx) {
          void handlers.openSkillBrowser(pi, currentCtx, "");
        }
      },
    },
    {
      shortcut: Key.ctrl("g"),
      description: "Open pull requests browser",
      execute: () => {
        if (currentCtx) {
          void handlers.openPullRequestsBrowser(pi, currentCtx);
        }
      },
    },
    {
      shortcut: Key.ctrl("u"),
      description: "Open Linear issues browser",
      execute: () => {
        if (currentCtx) {
          void handlers.openLinearIssuesBrowser(pi, currentCtx);
        }
      },
    },
    {
      shortcut: Key.ctrlShift("p"),
      description: "Open command palette",
      execute: () => {
        // Don't re-open command palette from itself
      },
    },
  ];

  /**
   * /commands - Open the command palette
   */
  pi.registerCommand("commands", {
    description: "Open command palette to search and execute commands",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      currentCtx = ctx;
      await handlers.openCommandPalette(pi, ctx, registeredShortcuts);
      currentCtx = null;
    },
  });

  /**
   * Ctrl+Shift+P shortcut handler
   */
  pi.registerShortcut(Key.ctrlShift("p"), {
    description: "Open command palette",
    handler: async (ctx) => {
      if (!ctx.hasUI) return;
      currentCtx = ctx;
      await handlers.openCommandPalette(pi, ctx, registeredShortcuts);
      currentCtx = null;
    },
  });

  return registeredShortcuts;
}
