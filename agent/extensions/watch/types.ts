/**
 * Type definitions for the comment watcher.
 */

export interface TriggerReference {
  filePath: string;
  lineNumber: number;
  rawLines: string[]; // Full comment lines including markers and PI
  hasTrigger: boolean; // true for !PI, false for PI
}

export interface TriggerWatcherOptions {
  /** Patterns to ignore when watching files */
  ignoredPatterns?: RegExp[];
  /** Current working directory for relative paths */
  cwd?: string;
  /** Whether to ignore initial files when starting watch */
  ignoreInitial?: boolean;
  /** Stability threshold for file writes (ms) */
  stabilityThreshold?: number;
  /** Poll interval for file writes (ms) */
  pollInterval?: number;
}

export type TriggerWatcherCallback = (referenece: TriggerReference) => void;

export type TriggerCallback = (comments: TriggerReference[]) => void;

export interface TriggerWatcherCallbacks {
  /** Called when a PI comment (without trigger) is found */
  onPIComment?: TriggerWatcherCallback;
  /** Called when a !PI comment (with trigger) is found */
  onPITrigger?: TriggerCallback;
  /** Called when the watcher is ready */
  onReady?: () => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

export type WatcherFactory = (
  paths: string | string[],
  options?: Record<string, unknown>,
) => FSWatcherLike;

export interface FSWatcherLike {
  /** Close the watcher */
  close(): Promise<void>;
  on(event: string, listener: (...args: unknown[]) => void): FSWatcherLike;
}
