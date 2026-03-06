/**
 * Semantic diff utilities using the `sem` CLI.
 *
 * For jujutsu working copy (`@`), uses `sem diff --format json` (working tree
 * mode) because jj's auto-committed `@` isn't visible to git the way sem
 * expects. For other changes, resolves to git SHAs and uses `--commit <sha>`.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getCurrentChangeIdShort } from "./jj";

export type SemChangeType =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "moved";

export interface SemChange {
  entityId: string;
  changeType: SemChangeType;
  entityType: string;
  entityName: string;
  filePath: string;
  beforeContent: string | null;
  afterContent: string | null;
  commitSha: string | null;
  author: string | null;
  /** Present on renames/moves */
  oldFilePath: string | null;
}

export interface SemDiffSummary {
  fileCount: number;
  added: number;
  modified: number;
  deleted: number;
  renamed: number;
  moved: number;
  total: number;
}

export interface SemDiffResult {
  summary: SemDiffSummary;
  changes: SemChange[];
}

const EMPTY_RESULT: SemDiffResult = {
  summary: {
    fileCount: 0,
    added: 0,
    modified: 0,
    deleted: 0,
    renamed: 0,
    moved: 0,
    total: 0,
  },
  changes: [],
};

/** Resolve a jujutsu change ID to a git commit SHA. */
async function resolveCommitSha(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
): Promise<string> {
  const result = await pi.exec(
    "jj",
    ["log", "-r", changeId, "--no-graph", "-T", "commit_id"],
    { cwd },
  );

  if (result.code !== 0) {
    throw new Error(
      result.stderr.trim() || `failed to resolve change ${changeId}`,
    );
  }

  const sha = result.stdout.trim();
  if (!sha) {
    throw new Error(`no commit SHA for change ${changeId}`);
  }
  return sha;
}

/** Parse sem diff JSON output, returning EMPTY_RESULT for "No changes detected." */
function parseSemOutput(stdout: string): SemDiffResult {
  const trimmed = stdout.trim();
  if (!trimmed || trimmed.includes("No changes detected")) {
    return EMPTY_RESULT;
  }
  return JSON.parse(trimmed) as SemDiffResult;
}

/**
 * Check if the given change ID is the jujutsu working copy (`@`).
 */
async function isWorkingCopy(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
): Promise<boolean> {
  const current = await getCurrentChangeIdShort(pi, cwd);
  return current !== null && current === changeId;
}

/**
 * Run `sem diff` on a jujutsu revision.
 *
 * Uses working tree mode for `@` (jj's auto-committed working copy isn't
 * visible to git), and `--commit <sha>` for other changes.
 */
export async function getSemanticDiff(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
): Promise<SemDiffResult> {
  if (await isWorkingCopy(pi, cwd, changeId)) {
    return getSemanticDiffWorking(pi, cwd);
  }

  const sha = await resolveCommitSha(pi, cwd, changeId);

  const result = await pi.exec(
    "sem",
    ["diff", "--commit", sha, "--format", "json"],
    { cwd },
  );

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "sem diff failed");
  }

  return parseSemOutput(result.stdout);
}

/**
 * Run `sem diff` for a commit range.
 */
export async function getSemanticDiffRange(
  pi: ExtensionAPI,
  cwd: string,
  from: string,
  to: string,
): Promise<SemDiffResult> {
  const result = await pi.exec(
    "sem",
    ["diff", "--from", from, "--to", to, "--format", "json"],
    { cwd },
  );

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "sem diff failed");
  }

  return parseSemOutput(result.stdout);
}

/**
 * Run `sem diff` on the working tree (unstaged changes).
 */
export async function getSemanticDiffWorking(
  pi: ExtensionAPI,
  cwd: string,
): Promise<SemDiffResult> {
  const result = await pi.exec("sem", ["diff", "--format", "json"], { cwd });

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || "sem diff failed");
  }

  return parseSemOutput(result.stdout);
}

/**
 * Get terminal-formatted semantic diff for display.
 */
export async function getSemanticDiffTerminal(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
): Promise<string[]> {
  let result;

  if (await isWorkingCopy(pi, cwd, changeId)) {
    result = await pi.exec("sem", ["diff"], { cwd });
  } else {
    const sha = await resolveCommitSha(pi, cwd, changeId);
    result = await pi.exec("sem", ["diff", "--commit", sha], { cwd });
  }

  if (result.code !== 0) {
    return [`Error: ${result.stderr.trim() || "sem diff failed"}`];
  }

  return result.stdout.split("\n");
}
