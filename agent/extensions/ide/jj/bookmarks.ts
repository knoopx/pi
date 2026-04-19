
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { sanitizeDescription } from "./core";


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

  if (result.code !== 0) return [];

  const seen = new Set<string>();
  const entries: {
    bookmark: string;
    changeId: string;
    description: string;
    author: string;
  }[] = [];

  for (const line of result.stdout.split("\n")) {
    const [name, changeId, description, author] = line.split("\t");
    if (!name || !changeId || seen.has(name)) continue;

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
