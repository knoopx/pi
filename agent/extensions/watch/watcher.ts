/**
 * CommentWatcher - Watches for file changes and detects PI comments.
 *
 * This class provides a higher-level abstraction over file watching that:
 * 1. Watches files using a Chokidar-compatible watcher
 * 2. Parses files for PI comments
 * 3. Manages pending comments across files
 * 4. Emits callbacks for PI comments and triggers (PI!)
 *
 * Behavior:
 * - PI comments (without !) are collected as pending changes
 * - !PI comments trigger the sending of all pending comments
 * - Event processing is paused while agent is editing files to avoid duplicates
 *
 * Usage:
 *   const watcher = new CommentWatcher(chokidarInstance, callbacks, options);
 *   watcher.watch("/path/to/watch");
 */

import {
  DEFAULT_IGNORED_PATTERNS,
  hasTriggerComment,
  readFileAndParseComments,
  shouldIgnorePath,
} from "./core";
import type {
  CommentWatcherCallbacks,
  CommentWatcherOptions,
  FSWatcherLike,
  ParsedComment,
  WatcherFactory,
} from "./types";

const DEFAULT_OPTIONS: Required<CommentWatcherOptions> = {
  ignoredPatterns: DEFAULT_IGNORED_PATTERNS,
  cwd: process.cwd(),
  ignoreInitial: true,
  stabilityThreshold: 500,
  pollInterval: 50,
};

export class CommentWatcher {
  private fsWatcher: FSWatcherLike | null = null;
  private pendingComments: Map<string, ParsedComment[]> = new Map();
  private callbacks: Required<CommentWatcherCallbacks>;
  private options: Required<CommentWatcherOptions>;
  private isWatching = false;
  private isPaused = false;

  constructor(
    private watcherFactory: WatcherFactory,
    callbacks: CommentWatcherCallbacks = {},
    options: CommentWatcherOptions = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.callbacks = {
      onPIComment: callbacks.onPIComment ?? (() => {}),
      onPITrigger: callbacks.onPITrigger ?? (() => {}),
      onReady: callbacks.onReady ?? (() => {}),
      onError: callbacks.onError ?? (() => {}),
    };
  }

  /**
   * Start watching a path for AI comments.
   */
  watch(watchPath: string): void {
    if (this.isWatching) {
      this.close();
    }

    this.fsWatcher = this.watcherFactory(watchPath, {
      ignored: this.options.ignoredPatterns,
      persistent: true,
      ignoreInitial: this.options.ignoreInitial,
      awaitWriteFinish: {
        stabilityThreshold: this.options.stabilityThreshold,
        pollInterval: this.options.pollInterval,
      },
    });
    this.isWatching = true;

    this.fsWatcher
      .on("add", (...args: unknown[]) => {
        if (args.length > 0 && typeof args[0] === "string") {
          this.handleChange(args[0] as string);
        }
      })
      .on("change", (...args: unknown[]) => {
        if (args.length > 0 && typeof args[0] === "string") {
          this.handleChange(args[0] as string);
        }
      })
      .on("unlink", (...args: unknown[]) => {
        if (args.length > 0 && typeof args[0] === "string") {
          this.handleChange(args[0] as string);
        }
      })
      .on("ready", () => {
        this.callbacks.onReady();
      })
      .on("error", (...args: unknown[]) => {
        if (args.length > 0 && args[0] instanceof Error) {
          this.callbacks.onError(args[0] as Error);
        }
      });
  }

  /**
   * Stop watching and clean up resources.
   */
  close(): void {
    if (this.fsWatcher) {
      void this.fsWatcher.close();
      this.fsWatcher = null;
    }
    this.isWatching = false;
    this.clearPending();
  }

  /**
   * Pause processing of file change events.
   * Useful for pausing while agent is editing files.
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume processing of file change events.
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Check if the watcher is currently paused.
   */
  isWatcherPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Clear all pending comments.
   */
  clearPending(): void {
    this.pendingComments.clear();
  }

  /**
   * Get all currently pending comments.
   */
  getPendingComments(): ParsedComment[] {
    const allComments: ParsedComment[] = [];
    for (const fileComments of this.pendingComments.values()) {
      allComments.push(...fileComments);
    }
    return allComments;
  }

  /**
   * Handle file change events from the file system watcher.
   */
  private handleChange(filePath: string): void {
    // Skip processing if paused (e.g., while agent is editing files)
    if (this.isPaused) {
      return;
    }

    if (shouldIgnorePath(filePath, this.options.ignoredPatterns)) {
      return;
    }

    const result = readFileAndParseComments(filePath);

    if (!result) {
      // File not readable - remove unknown pending comments for this file
      this.pendingComments.delete(filePath);
      return;
    }

    const { comments } = result;

    if (comments.length === 0) {
      // No AI comments - remove unknown pending for this file
      this.pendingComments.delete(filePath);
      return;
    }

    // Update pending comments for this file
    this.pendingComments.set(filePath, comments);

    // Emit callbacks for each PI comment (non-trigger)
    for (const comment of comments) {
      if (!comment.hasTrigger) {
        this.callbacks.onPIComment(comment, this.getPendingComments());
      }
    }

    // Check if unknown comment has a trigger (!PI)
    if (hasTriggerComment(comments)) {
      // Collect all pending comments from all files
      const allComments = this.getPendingComments();

      // Emit trigger callback
      this.callbacks.onPITrigger(allComments);

      // Clear pending comments after sending
      this.clearPending();
    }
  }
}
