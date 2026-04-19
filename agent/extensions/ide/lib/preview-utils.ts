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
      const content = await readFile(join(cwd, item.path), "utf8");
      return loadFilePreviewWithShiki(item.path, content, theme);
    } catch {
      return [];
    }
  };
}
