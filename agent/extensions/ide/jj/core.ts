
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function sanitizeDescription(rawDescription: string): string {
  const asciiOnly = rawDescription.replace(/[^\p{ASCII}]/gu, "");
  const normalizedWhitespace = asciiOnly.replace(/\s+/g, " ").trim();
  return normalizedWhitespace || "(no description)";
}


export 
function parseStdoutLines<T>(
  stdout: string,
  mapper: (line: string) => T | null,
): T[] {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map(mapper)
    .filter((item): item is T => item !== null);
}

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


export async function updateStaleWorkspace(
  pi: ExtensionAPI,
  cwd?: string,
): Promise<void> {
  await pi.exec("jj", ["workspace", "update-stale"], cwd ? { cwd } : undefined);
}