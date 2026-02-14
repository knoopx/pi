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
