import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Load file preview using bat with syntax highlighting.
 * Shared across files-component and symbols-component.
 */
export async function loadFilePreviewWithBat(
  pi: ExtensionAPI,
  filePath: string,
  cwd: string,
): Promise<string[]> {
  const result = await pi.exec("bat", ["--plain", "--color=always", filePath], {
    cwd,
  });
  if (result.code === 0) {
    return result.stdout.split("\n");
  }
  return [`Error reading file: ${result.stderr}`];
}
