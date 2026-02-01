/**
 * Watch Extension
 *
 * Watches for file changes in the current directory and scans for PI references.
 * Triggers actions immediately when !PI references are found.
 *
 * Any line containing PI (case insensitive) is considered a PI reference.
 * Lines with !PI trigger actions with all PI references from the same file.
 *
 * Runtime Toggle:
 *   /watch - Toggle watch mode on/off
 *   /watch on - Enable watch mode
 *   /watch off - Disable watch mode
 *
 * Examples:
 *   // !PI Add error handling
 *   // Add error handling !PI
 *   Fix this bug !PI
 *   !PI refactor to be cleaner
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import chokidar from "chokidar";

interface WatchUI {
  notify: (message: string, type?: "error" | "warning" | "info") => void;
}
import { createMessage, DEFAULT_IGNORED_PATTERNS } from "./core";
import type { TriggerReference } from "./types.js";
import { PIWatcher } from "./watcher.js";

export default function (pi: ExtensionAPI) {
  // Track watch state as a runtime setting
  let isWatchEnabled = false;
  let piWatcher: PIWatcher | null = null;
  let watchCwd: string | null = null;
  let watchCtx: { hasUI: boolean; ui: WatchUI } | null = null;

  const stopWatching = () => {
    if (piWatcher) {
      piWatcher.close();
      piWatcher = null;
    }
  };

  const startWatching = () => {
    if (!watchCwd || !watchCtx || piWatcher) {
      return;
    }

    const ignoredPatterns = DEFAULT_IGNORED_PATTERNS;

    piWatcher = new PIWatcher(
      (paths: string | string[], options?: Record<string, unknown>) =>
        chokidar.watch(paths, options),
      {
        onPITrigger: (references: TriggerReference[]) => {
          if (references.length === 0) return;

          const message = createMessage(references);

          try {
            pi.sendUserMessage(message);

            if (watchCtx?.hasUI) {
              const uniqueFiles = new Set(references.map((c) => c.filePath));
              watchCtx.ui.notify(
                `!PI reference found (sending ${references.length} reference${references.length > 1 ? "s" : ""} from ${uniqueFiles.size} file${uniqueFiles.size > 1 ? "s" : ""})`,
                "info",
              );
            }
          } catch (error) {
            if (watchCtx?.hasUI) {
              watchCtx.ui.notify(`Error sending message: ${error}`, "error");
            }
          }
        },

        onReady: () => {
          if (watchCtx?.hasUI) {
            watchCtx.ui.notify(`Watching ${watchCwd} for PI references...`, "info");
          }
        },

        onError: (error: Error) => {
          if (watchCtx?.hasUI) {
            watchCtx.ui.notify(`Watcher error: ${error.message}`, "error");
          }
        },
      },
      {
        cwd: watchCwd,
        ignoredPatterns,
        ignoreInitial: true,
        stabilityThreshold: 100,
        pollInterval: 25,
      },
    );

    piWatcher.watch(watchCwd);
  };

  // Register /watch command to toggle watch mode
  pi.registerCommand("watch", {
    description: "Toggle file watching for PI references (usage: /watch [on|off])",
    handler: async (args, ctx) => {
      const action = args.toLowerCase().trim() || "toggle";

      if (action === "on") {
        if (!isWatchEnabled) {
          isWatchEnabled = true;
          startWatching();
          if (watchCwd) {
            ctx.ui.notify(`Watch enabled for ${watchCwd}`, "info");
          }
        }
      } else if (action === "off") {
        if (isWatchEnabled) {
          isWatchEnabled = false;
          stopWatching();
          ctx.ui.notify("Watch disabled", "info");
        }
      } else {
        if (isWatchEnabled) {
          isWatchEnabled = false;
          stopWatching();
          ctx.ui.notify("Watch toggled off", "info");
        } else {
          isWatchEnabled = true;
          startWatching();
          if (watchCwd) {
            ctx.ui.notify(`Watch toggled on for ${watchCwd}`, "info");
          }
        }
      }
    },
  });

  // Pause watching while agent is editing files to avoid re-triggering
  pi.on("agent_start", async () => {
    piWatcher?.pause();
  });

  pi.on("agent_end", async () => {
    piWatcher?.resume();
    if (watchCtx?.hasUI && watchCwd && isWatchEnabled) {
      watchCtx.ui.notify(`Watching ${watchCwd} for PI references...`, "info");
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx) {
      return;
    }

    watchCwd = ctx.cwd;
    watchCtx = { hasUI: ctx.hasUI, ui: ctx.ui };
    stopWatching();

    if (isWatchEnabled) {
      startWatching();
    }
  });

  pi.on("session_shutdown", async () => {
    if (piWatcher) {
      piWatcher.close();
      piWatcher = null;
    }
    watchCwd = null;
    watchCtx = null;
  });
}
