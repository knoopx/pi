/**
 * PIWatcher - Watches for file changes and detects PI references.
 *
 * This class provides a higher-level abstraction over file watching that:
 * 1. Watches files using a Chokidar-compatible watcher
 * 2. Parses files for PI references
 * 3. Triggers actions immediately when !PI references are found
 *
 * Behavior:
 * - PI references (without !) are ignored
 * - !PI references trigger actions with all PI references from the same file
 * - Event processing is paused while agent is editing files to avoid duplicates
 *
 * Usage:
 *   const watcher = new PIWatcher(chokidarInstance, callbacks, options);
 *   watcher.watch("/path/to/watch");
 */

import {
  DEFAULT_IGNORED_PATTERNS,
  hasTrigger,
  readFileAndParsePIReferences,
  shouldIgnorePath,
} from "./core";
import type {
  TriggerWatcherCallbacks,
  TriggerWatcherOptions,
  FSWatcherLike,
  WatcherFactory,
} from "./types";

const DEFAULT_OPTIONS: Required<TriggerWatcherOptions> = {
  ignoredPatterns: DEFAULT_IGNORED_PATTERNS,
  cwd: process.cwd(),
  ignoreInitial: true,
  stabilityThreshold: 100,
  pollInterval: 25,
};

export class PIWatcher {
  private fsWatcher: FSWatcherLike | null = null;
  private callbacks: Required<TriggerWatcherCallbacks>;
  private options: Required<TriggerWatcherOptions>;
  private isWatching = false;
  private isPaused = false;

  constructor(
    private watcherFactory: WatcherFactory,
    callbacks: TriggerWatcherCallbacks = {},
    options: TriggerWatcherOptions = {},
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
   * Start watching a path for PI references.
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

    const result = readFileAndParsePIReferences(filePath);

    if (!result) {
      return;
    }

    const { references } = result;

    if (references.length === 0) {
      return;
    }

    // Check if any reference has a trigger (!PI)
    if (hasTrigger(references)) {
      // Emit trigger callback with references from this file only
      this.callbacks.onPITrigger(references);
    }
  }
}
