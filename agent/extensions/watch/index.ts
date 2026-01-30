/**
 * Watch Extension
 *
 * Watches for file changes in the current directory and scans for PI comments.
 * Collects PI comments until a PI! trigger is found, then sends all comments to the agent.
 *
 * Comment styles supported: #, //, --
 * Position: PI can be at start or end of comment line
 * Case insensitive: pi, PI both work
 *
 * PI - collects comment, doesn't trigger
 * !PI - triggers action with all collected comments
 *
 * Consecutive PI comments are grouped together.
 * Comments can span multiple files until a PI! is found.
 *
 * Usage:
 *   pi --watch
 *
 * Examples:
 *   // !PI Add error handling
 *   // Add error handling !PI
 *   # pi refactor to be cleaner
 *   -- make this faster !PI
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import chokidar from "chokidar";

interface WatchUI {
  notify: (message: string, type?: "error" | "warning" | "info") => void;
}
import { createMessage, DEFAULT_IGNORED_PATTERNS } from "./core";
import type { ParsedComment } from "./types.js";
import { CommentWatcher } from "./watcher.js";

export default function (pi: ExtensionAPI) {
  // Register the --watch flag
  pi.registerFlag("watch", {
    description: "Watch current directory for file changes with PI comments",
    type: "boolean",
    default: false,
  });

  let commentWatcher: CommentWatcher | null = null;
  let watchCwd: string | null = null;
  let watchCtx: { hasUI: boolean; ui: WatchUI } | null = null;

  // Pause watching while agent is editing files to avoid re-triggering
  pi.on("agent_start", async () => {
    commentWatcher?.pause();
  });

  pi.on("agent_end", async () => {
    commentWatcher?.resume();
    if (watchCtx?.hasUI && watchCwd) {
      watchCtx.ui.notify(`Watching ${watchCwd} for PI comments...`, "info");
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!pi.getFlag("watch")) {
      return;
    }

    const cwd = ctx.cwd;
    watchCwd = cwd;
    watchCtx = { hasUI: ctx.hasUI, ui: ctx.ui };
    const ignoredPatterns = DEFAULT_IGNORED_PATTERNS;

    // Create comment watcher with Chokidar factory
    commentWatcher = new CommentWatcher(
      (paths: string | string[], options?: Record<string, unknown>) =>
        chokidar.watch(paths, options),
      {
        onPIComment: (_comment: ParsedComment, allPending: ParsedComment[]) => {
          if (!watchCtx?.hasUI) return;
          const uniqueFiles = new Set(allPending.map((c) => c.filePath));
          watchCtx.ui.notify(
            `${allPending.length} PI comment${allPending.length > 1 ? "s" : ""} collected from ${uniqueFiles.size} file${uniqueFiles.size > 1 ? "s" : ""}.`,
            "info",
          );
        },

        onPITrigger: (comments: ParsedComment[]) => {
          if (comments.length === 0) return;

          // Send the message
          const message = createMessage(comments);

          try {
            pi.sendUserMessage(message, { deliverAs: "followUp" });

            if (watchCtx?.hasUI) {
              const uniqueFiles = new Set(comments.map((c) => c.filePath));
              watchCtx.ui.notify(
                `!PI comment found (sending ${comments.length} comment${comments.length > 1 ? "s" : ""} from ${uniqueFiles.size} file${uniqueFiles.size > 1 ? "s" : ""})`,
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
            watchCtx.ui.notify(`Watching ${cwd} for PI comments...`, "info");
          }
        },

        onError: (error: Error) => {
          if (watchCtx?.hasUI) {
            watchCtx.ui.notify(`Watcher error: ${error.message}`, "error");
          }
        },
      },
      {
        cwd,
        ignoredPatterns,
        ignoreInitial: true,
        stabilityThreshold: 500,
        pollInterval: 50,
      },
    );

    // Start watching
    commentWatcher.watch(cwd);
  });

  pi.on("session_shutdown", async () => {
    if (commentWatcher) {
      commentWatcher.close();
      commentWatcher = null;
    }
    watchCwd = null;
    watchCtx = null;
  });
}
