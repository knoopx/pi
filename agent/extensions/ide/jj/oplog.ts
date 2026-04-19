
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { sanitizeDescription } from "./core";


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


export async function getOpShow(
  pi: ExtensionAPI,
  cwd: string,
  opId: string,
): Promise<string[]> {
  const result = await pi.exec("jj", ["op", "show", "--color=always", opId], {
    cwd,
  });
  if (result.code === 0) return result.stdout.split("\n");
  return [`Error: ${result.stderr}`];
}


export async function restoreOp(
  pi: ExtensionAPI,
  cwd: string,
  opId: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  const result = await pi.exec("jj", ["op", "restore", opId], { cwd });
  if (result.code === 0)
    return { success: true, output: result.stderr || result.stdout };
  return { success: false, error: result.stderr };
}


export async function undoOp(
  pi: ExtensionAPI,
  cwd: string,
): Promise<{ success: boolean; output?: string; error?: string }> {
  const result = await pi.exec("jj", ["undo"], { cwd });
  if (result.code === 0)
    return { success: true, output: result.stderr || result.stdout };
  return { success: false, error: result.stderr };
}


export interface OpLogEntry {
  opId: string;
  description: string;
}
