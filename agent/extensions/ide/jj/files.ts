
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { FileChange } from "../lib/types";
import { parseStdoutLines, updateStaleWorkspace } from "./core";


export async function loadChangedFiles(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
): Promise<FileChange[]> {
  const result = await pi.exec(
    "jj",
    [
      "log",
      "-r",
      changeId,
      "-n1",
      "--no-graph",
      "-T",
      'self.diff().stat().files().map(|f| f.status_char() ++ " " ++ f.path() ++ " " ++ f.lines_added() ++ " " ++ f.lines_removed()).join("\\n")',
    ],
    { cwd },
  );

  if (result.code !== 0) return [];

  return parseStdoutLines(result.stdout, (line) => {
    const match = /^([AMDRE?])\s+(.+)\s+(\d+)\s+(\d+)$/.exec(line);
    if (match) {
      return {
        status: match[1],
        path: match[2],
        insertions: parseInt(match[3], 10),
        deletions: parseInt(match[4], 10),
      };
    }
    return null;
  }).sort((a, b) => a.path.localeCompare(b.path));
}


export async function getRawDiff(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
  filePath?: string,
): Promise<{ diff: string; files: string[] }> {
  await updateStaleWorkspace(pi, cwd);

  // When a specific file is requested, resolve paths relative to repo root.
  // File paths from loadChangedFiles are always repo-root-relative.
  const execCwd = filePath ? await getRepoRoot(pi, cwd) : cwd;

  const jjArgs = ["diff", "--git", "-r", changeId];
  if (filePath) jjArgs.push(filePath);

  const result = await pi.exec("jj", jjArgs, { cwd: execCwd });

  if (result.code === 0) {
    const diff = result.stdout;
    const files = diff
      .split("\n")
      .filter(
        (line) => line.startsWith("diff --git") || line.startsWith("index "),
      )
      .map((line) => {
        if (line.startsWith("diff --git")) {
          const parts = line.split(" ");
          if (parts.length >= 4)
            return parts[3].replace(/^a\//, "").replace(/^b\//, "");
        }
        return "";
      })
      .filter(Boolean);
    return { diff, files };
  }
  throw new Error(`Failed to get diff: ${result.stderr}`);
}


export async function restoreFile(
  pi: ExtensionAPI,
  cwd: string,
  changeId: string,
  filePath: string,
): Promise<string> {
  const repoRoot = await getRepoRoot(pi, cwd);

  const result = await pi.exec(
    "jj",
    ["restore", "--changes-in", changeId, filePath],
    { cwd: repoRoot },
  );

  if (result.code !== 0) {
    const error = result.stderr.trim() || "Failed to discard file changes";
    throw new Error(error);
  }
  return result.stderr || result.stdout;
}


export async function getRepoRoot(
  pi: ExtensionAPI,
  cwd = process.cwd(),
): Promise<string> {
  const result = await pi.exec("jj", ["workspace", "root"], { cwd });
  if (result.code !== 0) return cwd;
  return result.stdout.trim();
}
