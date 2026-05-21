import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { sanitizeDescription } from "./jj-base";
export async function setBookmarkToChange(
  pi: ExtensionAPI,
  cwd: string,
  bookmarkName: string,
  changeId: string,
): Promise<void> {
  const normalizedBookmarkName = bookmarkName.split("@")[0]?.trim();
  if (!normalizedBookmarkName) throw new Error("Bookmark name is required");
  const result = await pi.exec(
    "jj",
    [
      "bookmark",
      "set",
      "--allow-backwards",
      normalizedBookmarkName,
      "-r",
      changeId,
    ],
    {
      cwd,
    },
  );

  if (result.code !== 0)
    throw new Error(result.stderr || "Failed to set bookmark");
}
function parseBookmarkLine(line: string): {
  name: string;
  changeId: string;
  description: string;
  author: string;
} | null {
  const parts = line.split("\t");
  if (parts.length < 2) return null;
  return {
    name: parts[0],
    changeId: parts[1],
    description: parts[2] ?? "",
    author: parts[3] ?? "",
  };
}

function isDuplicateBookmark(name: string, seen: Set<string>): boolean {
  return seen.has(name);
}

export async function listBookmarksByChange(
  pi: ExtensionAPI,
  cwd: string,
): Promise<
  { bookmark: string; changeId: string; description: string; author: string }[]
> {
  const result = await pi.exec("jj", BOOKMARK_LIST_ARGS, { cwd });
  if (result.code !== 0) return [];
  return parseBookmarkListOutput(result.stdout);
}

const BOOKMARK_LIST_ARGS = [
  "bookmark",
  "list",
  "-T",
  'self.name() ++ "\t" ++ coalesce(self.normal_target().change_id().short(), "") ++ "\t" ++ coalesce(self.normal_target().description().first_line(), "") ++ "\t" ++ coalesce(self.normal_target().author().name(), "") ++ "\n"',
];

function parseBookmarkListOutput(output: string): {
  bookmark: string;
  changeId: string;
  description: string;
  author: string;
}[] {
  const seen = new Set<string>();
  const entries: {
    bookmark: string;
    changeId: string;
    description: string;
    author: string;
  }[] = [];

  for (const line of output.split("\n")) {
    const parsed = parseBookmarkLine(line);
    if (!parsed) continue;
    if (isDuplicateBookmark(parsed.name, seen)) continue;
    seen.add(parsed.name);
    entries.push(buildBookmarkEntry(parsed));
  }

  return entries;
}

function buildBookmarkEntry(
  parsed: NonNullable<ReturnType<typeof parseBookmarkLine>>,
) {
  return {
    bookmark: parsed.name,
    changeId: parsed.changeId,
    description: sanitizeDescription(parsed.description),
    author: parsed.author,
  };
}
export async function forgetBookmark(
  pi: ExtensionAPI,
  cwd: string,
  bookmarkRef: string,
): Promise<string> {
  const bookmarkName = bookmarkRef.split("@")[0]?.trim();
  if (!bookmarkName) return "";
  const result = await pi.exec(
    "jj",
    ["bookmark", "forget", "--include-remotes", bookmarkName],
    { cwd },
  );
  return result.stderr || result.stdout;
}
