/**
 * Jujutsu command utilities
 *
 * Centralized jj operations to avoid duplication across components.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { FileChange, Change } from "./types";

export function notifyMutation(
  pi: ExtensionAPI,
  customType: string,
  output: string,
): void {
  const text = output.trim();
  if (!text) return;
  pi.sendMessage({
    customType,
    content: [{ type: "text", text }],
    display: true,
  });
}

export function sanitizeDescription(rawDescription: string): string {
  const asciiOnly = rawDescription.replace(/[^\p{ASCII}]/gu, "");
  const normalizedWhitespace = asciiOnly.replace(/\s+/g, " ").trim();
  return normalizedWhitespace || "(no description)";
}

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
 * Load changes from the repository
 */
export async function loadChanges(
  pi: ExtensionAPI,
  cwd: string,
  revision = "ancestors(@, 50) ~ root()",
): Promise<Change[]> {
  const result = await pi.exec(
    "jj",
    [
      "log",
      "-r",
      revision,
      "--no-graph",
      "-T",
      'change_id.short() ++ "\\t" ++ commit_id.short() ++ "\\t" ++ if(empty, "empty", "changed") ++ "\\t" ++ if(immutable, "immutable", "mutable") ++ "\\t" ++ author.name() ++ "\\t" ++ author.timestamp().format("%Y-%m-%d %H:%M") ++ "\\t" ++ separate(",", parents.map(|p| p.change_id().short())) ++ "\\t" ++ description.first_line() ++ "\\n"',
    ],
    { cwd },
  );

  if (result.code !== 0) return [];

  return result.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [
        changeId,
        commitId,
        emptyStr,
        immutableStr,
        author,
        timestamp,
        parentIds,
        ...descParts
      ] = line.split("\t");
      return {
        changeId: changeId || "",
        commitId: commitId || "",
        description: sanitizeDescription(descParts.join("\t")),
        author: author || "",
        timestamp: timestamp || "",
        empty: emptyStr === "empty",
        immutable: immutableStr === "immutable",
        parentIds: parentIds ? parentIds.split(",").filter(Boolean) : [],
      };
    })
    .filter((c) => c.changeId);
}

/**
 * Get current workspace change id as a short id
 */
export async function getCurrentChangeIdShort(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | null> {
  const result = await pi.exec(
    "jj",
    ["log", "-r", "@", "--no-graph", "-T", 'change_id.short() ++ "\\n"'],
    { cwd },
  );

  if (result.code !== 0) {
    return null;
  }

  const changeId = result.stdout.trim();
  return changeId || null;
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
    .filter((f): f is FileChange => f !== null)
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Get diff output with delta formatting
 */
export async function getDiff(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
  filePath?: string,
): Promise<string[]> {
  await updateStaleWorkspace(pi, cwd);

  const jjArgs = ["diff", "--git", "-r", changeId];
  if (filePath) {
    jjArgs.push(filePath);
  }

  const escapeArg = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const result = await pi.exec(
    "bash",
    ["-c", `jj ${jjArgs.map(escapeArg).join(" ")} | delta --paging=never`],
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
): Promise<string> {
  const result = await pi.exec(
    "jj",
    ["restore", "--changes-in", changeId, filePath],
    { cwd },
  );

  if (result.code !== 0) {
    const error = result.stderr.trim() || "Failed to discard file changes";
    throw new Error(error);
  }
  return result.stderr || result.stdout;
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
export async function listBookmarksByChange(
  pi: ExtensionAPI,
  cwd: string,
): Promise<
  { bookmark: string; changeId: string; description: string; author: string }[]
> {
  const result = await pi.exec(
    "jj",
    [
      "bookmark",
      "list",
      "-T",
      'self.name() ++ "\t" ++ coalesce(self.normal_target().change_id().short(), "") ++ "\t" ++ coalesce(self.normal_target().description().first_line(), "") ++ "\t" ++ coalesce(self.normal_target().author().name(), "") ++ "\n"',
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
    author: string;
  }[] = [];

  for (const line of result.stdout.split("\n")) {
    const [name, changeId, description, author] = line.split("\t");
    if (!name || !changeId || seen.has(name)) {
      continue;
    }

    seen.add(name);
    entries.push({
      bookmark: name,
      changeId,
      description: sanitizeDescription(description || ""),
      author: author || "",
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
): Promise<string> {
  const bookmarkName = bookmarkRef.split("@")[0]?.trim();
  if (!bookmarkName) {
    return "";
  }

  const result = await pi.exec(
    "jj",
    ["bookmark", "forget", "--include-remotes", bookmarkName],
    { cwd },
  );
  return result.stderr || result.stdout;
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
        description: sanitizeDescription(descParts.join("|")),
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
): Promise<{ success: boolean; output?: string; error?: string }> {
  const result = await pi.exec("jj", ["op", "restore", opId], { cwd });
  if (result.code === 0) {
    return { success: true, output: result.stderr || result.stdout };
  }
  return { success: false, error: result.stderr };
}

/**
 * Undo last operation
 */
export async function undoOp(
  pi: ExtensionAPI,
  cwd: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  const result = await pi.exec("jj", ["undo"], { cwd });
  if (result.code === 0) {
    return { success: true, output: result.stderr || result.stdout };
  }
  return { success: false, error: result.stderr };
}

/** Blame info for a line */
/**
 * Get current branch/bookmark label for status display
 */
export async function getVcsLabel(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | null> {
  // Find bookmarks in ancestry of current change (like git branch name)
  const result = await pi.exec(
    "jj",
    [
      "log",
      "-r",
      "ancestors(@) & bookmarks()",
      "--no-graph",
      "-n1",
      "-T",
      'bookmarks.join(", ") ++ "\\n"',
    ],
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
