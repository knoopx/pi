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
      const match = line.match(/^([AMD])\s+(.+)$/);
      return match ? { status: match[1]!, path: match[2]! } : null;
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
  await pi.exec("jj", ["bookmark", "set", bookmarkName, "-r", changeId], {
    cwd,
  });
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
): Promise<Array<{ bookmark: string; changeId: string }>> {
  const result = await pi.exec("jj", ["bookmark", "list", "--all-remotes"], {
    cwd,
  });

  if (result.code !== 0) {
    return [];
  }

  const seen = new Set<string>();
  const entries: Array<{ bookmark: string; changeId: string }> = [];
  let currentLocalName: string | null = null;

  for (const rawLine of result.stdout.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      continue;
    }

    const localMatch = line.match(/^([^:\s]+):\s+([a-z0-9]+)/i);
    if (localMatch) {
      currentLocalName = localMatch[1] || null;
      const changeId = localMatch[2] || "";
      const bookmark = `${currentLocalName}@`;
      if (changeId && !seen.has(bookmark)) {
        seen.add(bookmark);
        entries.push({ bookmark, changeId });
      }
      continue;
    }

    const remoteMatch = line.match(/^\s*@([^:]+):\s+([a-z0-9]+)/i);
    if (remoteMatch && currentLocalName) {
      const remote = remoteMatch[1] || "";
      const changeId = remoteMatch[2] || "";
      const bookmark = `${currentLocalName}@${remote}`;
      if (remote && changeId && !seen.has(bookmark)) {
        seen.add(bookmark);
        entries.push({ bookmark, changeId });
      }
    }
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
