/**
 * Shared types for IDE extension
 */

/**
 * Agent workspace status
 */
export type WorkspaceStatus = "running" | "completed" | "failed" | "idle";

/**
 * Represents a jujutsu workspace with a running/completed agent
 */
export interface AgentWorkspace {
  /** Workspace name (used by jj and tmux) */
  name: string;
  /** Absolute path to the workspace directory */
  path: string;
  /** Task description provided when creating the workspace */
  description: string;
  /** Current status of the agent */
  status: WorkspaceStatus;
  /** Jujutsu change ID for this workspace */
  changeId: string;
  /** Parent change ID (the change @ was at when workspace was created) */
  parentChangeId: string;
  /** Timestamp when workspace was created */
  createdAt: number;
  /** File stats from jj diff */
  fileStats?: {
    added: number;
    modified: number;
    deleted: number;
  };
}

/**
 * Result of parsing jj workspace list output
 */
export interface WorkspaceListEntry {
  name: string;
  changeId: string;
  description: string;
}

/**
 * Result of running jj diff --stat
 */
export interface DiffStats {
  files: {
    path: string;
    status: "added" | "modified" | "deleted";
    insertions: number;
    deletions: number;
  }[];
  totalInsertions: number;
  totalDeletions: number;
}

/**
 * File change from jj diff --summary
 */
export interface FileChange {
  status: string;
  path: string;
  insertions?: number;
  deletions?: number;
}

/**
 * Change from jj log
 */
export interface Change {
  changeId: string;
  commitId: string;
  description: string;
  author?: string;
  timestamp?: string;
  empty: boolean;
  immutable: boolean;
  parentIds?: string[];
}

/**
 * Bookmark filter modes
 */
export const BOOKMARK_FILTER_MODES = [
  "all",
  "bookmarks",
  "descriptions",
  "authors",
] as const;

export type BookmarkFilterMode = (typeof BOOKMARK_FILTER_MODES)[number];

/**
 * Format file stats for display
 */
export function formatFileStats(ws: AgentWorkspace): string {
  if (!ws.fileStats) return "";
  const { added, modified, deleted } = ws.fileStats;
  const parts: string[] = [];
  if (added > 0) parts.push(`+${added}`);
  if (modified > 0) parts.push(`~${modified}`);
  if (deleted > 0) parts.push(`-${deleted}`);
  return parts.length > 0 ? `[${parts.join(" ")}]` : "";
}

/**
 * Key pattern type for keyboard bindings
 */
export type KeyPattern = string | (string & {});
