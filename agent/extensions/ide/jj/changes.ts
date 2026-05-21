import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Change } from "../types";
import { sanitizeDescription, parseStdoutLines } from "./jj-base";
const CHANGE_ID_TEMPLATE =
  'change_id ++ coalesce(if(divergent, "/" ++ stringify(change_offset)), "")';

function parseChangeLine(line: string): Change | null {
  const parts = line.split("\t");
  if (parts.length < 7) return null;
  const [
    changeId,
    commitId,
    emptyStr,
    immutableStr,
    author,
    timestamp,
    parentIds,
    ...descParts
  ] = parts;
  const change: Change = {
    changeId: orEmpty(changeId),
    commitId: orEmpty(commitId),
    description: sanitizeDescription(descParts.join("\t")),
    author: orEmpty(author),
    timestamp: orEmpty(timestamp),
    empty: emptyStr === "empty",
    immutable: immutableStr === "immutable",
    parentIds: parentIds ? parentIds.split(",").filter(Boolean) : [],
  };
  return change.changeId ? change : null;
}

function orEmpty(value: string): string {
  return value || "";
}
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

  return parseStdoutLines(result.stdout, parseChangeLine);
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

async function tryGetBookmarks(
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
  return bookmarks ? `󰃀 ${bookmarks}` : null;
}

async function tryGetChangeId(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | null> {
  const changeResult = await pi.exec(
    "jj",
    ["log", "-r", "@", "--no-graph", "-T", `${CHANGE_ID_TEMPLATE} ++ "\\n"`],
    { cwd },
  );

  if (changeResult.code !== 0) return null;
  const changeId = changeResult.stdout.trim();
  return changeId ? `◎ ${changeId}` : null;
}

export async function getVcsLabel(
  pi: ExtensionAPI,
  cwd: string,
): Promise<string | null> {
  const bookmarks = await tryGetBookmarks(pi, cwd);
  if (bookmarks) return bookmarks;
  return tryGetChangeId(pi, cwd);
}
