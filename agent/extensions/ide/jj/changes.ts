import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Change } from "../lib/types";
import { sanitizeDescription, parseStdoutLines } from "./core";

const CHANGE_ID_TEMPLATE =
  'change_id ++ coalesce(if(divergent, "/" ++ stringify(change_offset)), "")';

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
      `${CHANGE_ID_TEMPLATE} ++ "\\t" ++ commit_id.short() ++ "\\t" ++ if(empty, "empty", "changed") ++ "\\t" ++ if(immutable, "immutable", "mutable") ++ "\\t" ++ author.name() ++ "\\t" ++ author.timestamp().format("%Y-%m-%d %H:%M") ++ "\\t" ++ separate(",", parents.map(|p| p.change_id() ++ coalesce(if(p.divergent(), "/" ++ stringify(p.change_offset())), ""))) ++ "\\t" ++ description.first_line() ++ "\\n"`,
    ],
    { cwd },
  );

  if (result.code !== 0) return [];

  return parseStdoutLines(result.stdout, (line) => {
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
    const change = {
      changeId: changeId || "",
      commitId: commitId || "",
      description: sanitizeDescription(descParts.join("\t")),
      author: author || "",
      timestamp: timestamp || "",
      empty: emptyStr === "empty",
      immutable: immutableStr === "immutable",
      parentIds: parentIds ? parentIds.split(",").filter(Boolean) : [],
    };
    return change.changeId ? change : null;
  });
}

export async function getCurrentChangeIdShort(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | null> {
  const result = await pi.exec(
    "jj",
    ["log", "-r", "@", "--no-graph", "-T", `${CHANGE_ID_TEMPLATE} ++ "\\n"`],
    { cwd },
  );

  if (result.code !== 0) return null;

  const changeId = result.stdout.trim();
  return changeId || null;
}

export async function hasFileChanges(
  pi: ExtensionAPI,
  cwd: string,
): Promise<boolean> {
  const result = await pi.exec(
    "jj",
    [
      "log",
      "-r",
      "@",
      "--no-graph",
      "-T",
      'if(empty, "empty", "changed") ++ "\n"',
    ],
    { cwd },
  );
  if (result.code !== 0) return false;
  return result.stdout.trim() === "changed";
}

export async function createNewChange(
  pi: ExtensionAPI,
  cwd: string,
): Promise<{
  success: boolean;
  changeId?: string;
  created: boolean;
  error?: string;
}> {
  const hasChanges = await hasFileChanges(pi, cwd);
  if (!hasChanges) {
    return { success: true, created: false };
  }
  const result = await pi.exec("jj", ["new"], { cwd });
  if (result.code === 0) {
    const changeResult = await pi.exec(
      "jj",
      ["log", "-r", "@", "--no-graph", "-T", `${CHANGE_ID_TEMPLATE} ++ "\n"`],
      { cwd },
    );
    if (changeResult.code === 0) {
      return {
        success: true,
        changeId: changeResult.stdout.trim(),
        created: true,
      };
    }
    return { success: true, created: true };
  }
  return { success: false, error: result.stderr, created: false };
}

export async function getVcsLabel(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | null> {
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
  if (bookmarks) return `󰃀 ${bookmarks}`;

  // Fall back to change ID
  const changeResult = await pi.exec(
    "jj",
    ["log", "-r", "@", "--no-graph", "-T", `${CHANGE_ID_TEMPLATE} ++ "\\n"`],
    { cwd },
  );

  if (changeResult.code === 0) {
    const changeId = changeResult.stdout.trim();
    return changeId ? `◎ ${changeId}` : null;
  }

  return null;
}
