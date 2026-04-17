import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { loadFilePreviewWithShiki } from "./file-preview";

export function createFilePreviewLoader(
  pi: ExtensionAPI,
  cwd: string,
  theme: Theme,
): (item: { path: string }) => Promise<string[]> {
  return async (item) => {
    const result = await pi.exec("cat", [item.path], { cwd });
    if (result.code !== 0)
      throw new Error(`Failed to read ${item.path}: ${result.stderr}`);
    return loadFilePreviewWithShiki(item.path, result.stdout, theme);
  };
}
