import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { loadFilePreviewWithShiki } from "./file-preview";

export function createFilePreviewLoader(
  cwd: string,
  theme: Theme,
): (item: { path: string }) => Promise<string[]> {
  return async (item) => {
    try {
      const fullPath = join(cwd, item.path);
      const content = await readFile(fullPath, "utf8");
      return loadFilePreviewWithShiki(item.path, content, theme);
    } catch {
      return [];
    }
  };
}
