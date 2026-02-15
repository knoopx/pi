/**
 * Jujutsu command utilities
 *
 * Centralized jj operations to avoid duplication across components.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { FileChange, MutableChange } from "./types";

/**
 * Update stale working copy if needed.
 * Jj working copies can become stale when the repo state changes.
 */
export async function updateStaleWorkspace(
  pi: ExtensionAPI,
  cwd?: string,
): Promise<void> {
  await pi.exec("jj", ["workspace", "update-stale"], cwd ? { cwd } : undefined);
}

/**
 * Load mutable changes from the current branch
 */
export async function loadMutableChanges(
  pi: ExtensionAPI,
  cwd: string,
  revision = "ancestors(@) ~ ancestors(immutable_heads())",
): Promise<MutableChange[]> {
  const result = await pi.exec(
    "jj",
    [
      "log",
      "-r",
      revision,
      "--no-graph",
      "-T",
      'change_id.short() ++ "\\t" ++ commit_id.short() ++ "\\t" ++ if(empty, "empty", "changed") ++ "\\t" ++ author.name() ++ "\\t" ++ author.timestamp().format("%Y-%m-%d %H:%M") ++ "\\t" ++ description.first_line() ++ "\\n"',
    ],
    { cwd },
  );

  if (result.code !== 0) return [];

  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [changeId, commitId, emptyStr, author, timestamp, ...descParts] =
        line.split("\t");
      return {
        changeId: changeId || "",
        commitId: commitId || "",
        description: descParts.join("\t") || "(no description)",
        author: author || "",
        timestamp: timestamp || "",
        empty: emptyStr === "empty",
      };
    })
    .filter((c) => c.changeId);
}

/**
 * Load changed files for a specific change
 */
export async function loadChangedFiles(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
): Promise<FileChange[]> {
  const result = await pi.exec("jj", ["diff", "-r", changeId, "--summary"], {
    cwd,
  });

  if (result.code !== 0) return [];

  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = /^([AMD])\s+(.+)$/.exec(line);
      return match ? { status: match[1], path: match[2] } : null;
    })
    .filter((f): f is FileChange => f !== null);
}

/**
 * Get diff output with diff-so-fancy formatting
 */
export async function getDiff(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
  filePath?: string,
): Promise<string[]> {
  await updateStaleWorkspace(pi, cwd);

  const jjArgs = ["diff", "--git", "--color=never", "-r", changeId];
  if (filePath) {
    jjArgs.push(filePath);
  }

  const result = await pi.exec(
    "bash",
    ["-c", `jj ${jjArgs.map((a) => `'${a}'`).join(" ")} | diff-so-fancy`],
    { cwd },
  );

  if (result.code === 0) {
    return result.stdout.split("\n");
  }
  return [`Failed to get diff: ${result.stderr}`];
}

/**
 * Restore (discard) changes to a file
 */
export async function restoreFile(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
  filePath: string,
): Promise<void> {
  await pi.exec("jj", ["restore", "-r", changeId, filePath], { cwd });
}

/**
 * Move a bookmark to a change
 */
export async function setBookmarkToChange(
  pi: ExtensionAPI,
  cwd: string,
  bookmarkName: string,
  changeId: string,
): Promise<void> {
  const normalizedBookmarkName = bookmarkName.split("@")[0]?.trim();
  if (!normalizedBookmarkName) {
    throw new Error("Bookmark name is required");
  }

  const result = await pi.exec(
    "jj",
    ["bookmark", "set", normalizedBookmarkName, "-r", changeId],
    {
      cwd,
    },
  );

  if (result.code !== 0) {
    throw new Error(result.stderr || "Failed to set bookmark");
  }
}

/**
 * List bookmark names (local and remotes) as name@remote
 */
export async function listBookmarks(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string[]> {
  const entries = await listBookmarksByChange(pi, cwd);
  return entries.map((entry) => entry.bookmark);
}

export async function listBookmarksByChange(
  pi: ExtensionAPI,
  cwd: string,
): Promise<{ bookmark: string; changeId: string; description: string }[]> {
  const result = await pi.exec(
    "jj",
    [
      "bookmark",
      "list",
      "--all-remotes",
      "-T",
      'self.name() ++ "\t" ++ coalesce(self.remote(), "") ++ "\t" ++ coalesce(self.normal_target().change_id().short(), "") ++ "\t" ++ coalesce(self.normal_target().description().first_line(), "") ++ "\n"',
    ],
    { cwd },
  );

  if (result.code !== 0) {
    return [];
  }

  const seen = new Set<string>();
  const entries: {
    bookmark: string;
    changeId: string;
    description: string;
  }[] = [];

  for (const line of result.stdout.split("\n")) {
    const [name, remote, changeId, description] = line.split("\t");
    if (!name || !changeId) {
      continue;
    }

    const bookmark = remote ? `${name}@${remote}` : `${name}@`;
    if (seen.has(bookmark)) {
      continue;
    }

    seen.add(bookmark);
    entries.push({
      bookmark,
      changeId,
      description: description || "(no description)",
    });
  }

  return entries;
}

/**
 * Forget a bookmark (including tracked remotes for the same name)
 */
export async function forgetBookmark(
  pi: ExtensionAPI,
  cwd: string,
  bookmarkRef: string,
): Promise<void> {
  const bookmarkName = bookmarkRef.split("@")[0]?.trim();
  if (!bookmarkName) {
    return;
  }

  await pi.exec(
    "jj",
    ["bookmark", "forget", "--include-remotes", bookmarkName],
    { cwd },
  );
}

/** Operation log entry */
export interface OpLogEntry {
  opId: string;
  description: string;
}

/**
 * Load operation log entries
 */
export async function loadOpLog(
  pi: ExtensionAPI,
  cwd: string,
  limit = 100,
): Promise<OpLogEntry[]> {
  const result = await pi.exec(
    "jj",
    [
      "op",
      "log",
      "--limit",
      String(limit),
      "-T",
      'self.id().short() ++ "|" ++ self.description() ++ "\\n"',
      "--no-graph",
    ],
    { cwd },
  );

  if (result.code !== 0) return [];

  return result.stdout
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const [opId, ...descParts] = line.split("|");
      return {
        opId: opId || "",
        description: descParts.join("|") || "(no description)",
      };
    })
    .filter((e) => e.opId);
}

/**
 * Get operation details
 */
export async function getOpShow(
  pi: ExtensionAPI,
  cwd: string,
  opId: string,
): Promise<string[]> {
  const result = await pi.exec("jj", ["op", "show", "--color=always", opId], {
    cwd,
  });
  if (result.code === 0) {
    return result.stdout.split("\n");
  }
  return [`Error: ${result.stderr}`];
}

/**
 * Restore to an operation
 */
export async function restoreOp(
  pi: ExtensionAPI,
  cwd: string,
  opId: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await pi.exec("jj", ["op", "restore", opId], { cwd });
  if (result.code === 0) {
    return { success: true };
  }
  return { success: false, error: result.stderr };
}

/**
 * Undo last operation
 */
export async function undoOp(
  pi: ExtensionAPI,
  cwd: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await pi.exec("jj", ["undo"], { cwd });
  if (result.code === 0) {
    return { success: true };
  }
  return { success: false, error: result.stderr };
}

/** Blame info for a line */
export interface BlameInfo {
  author: string;
  changeId: string;
  timestamp: string;
  line: number;
}

/**
 * Get blame info for a file
 */
export async function getBlame(
  pi: ExtensionAPI,
  cwd: string,
  filePath: string,
): Promise<BlameInfo[]> {
  const result = await pi.exec(
    "jj",
    ["file", "annotate", "--ignore-working-copy", filePath],
    { cwd },
  );

  if (result.code !== 0) return [];

  // Parse jj annotate output: "changeId author timestamp lineNum: content"
  // Example: "vznzwsql knoopx   2026-02-14 23:04:06    1: /**"
  return result.stdout
    .split("\n")
    .map((line, index) => {
      // Format: "changeId author timestamp lineNum: content"
      const match = /^(\w+)\s+(\S+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+\d+:/.exec(line);
      if (!match) return null;

      const [, changeId, author, timestamp] = match;
      return {
        author: author || "",
        changeId: changeId || "",
        timestamp: timestamp || "",
        line: index + 1,
      };
    })
    .filter((b): b is BlameInfo => b !== null);
}

/**
 * Get current branch/bookmark label for status display
 */
export async function getVcsLabel(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | null> {
  // Get current change bookmarks
  const result = await pi.exec(
    "jj",
    ["log", "-r", "@", "--no-graph", "-T", 'separate(" ", bookmarks) ++ "\\n"'],
    { cwd },
  );

  if (result.code !== 0) return null;

  const bookmarks = result.stdout.trim();
  if (bookmarks) {
    return `󰃀 ${bookmarks}`;
  }

  // Fall back to change ID
  const changeResult = await pi.exec(
    "jj",
    ["log", "-r", "@", "--no-graph", "-T", 'change_id.short() ++ "\\n"'],
    { cwd },
  );

  if (changeResult.code === 0) {
    const changeId = changeResult.stdout.trim();
    return changeId ? `◎ ${changeId}` : null;
  }

  return null;
}
