import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Pi } from "@mariozechner/pi-agent-core";
import { loadFilePreviewWithShiki } from "./file-preview";

/**
 * Create a loadPreview function for list picker components.
 * Reads file content and returns syntax-highlighted preview.
 *
 * Usage:
 * ```ts
 * const loadPreview = createFilePreviewLoader(pi, cwd, theme);
 * // In list picker:
 * loadPreview: (item) => loadPreview(item)
 * ```
 */
export function createFilePreviewLoader(
  pi: Pi,
  cwd: string,
  theme: Theme,
): (item: { path: string }) => Promise<string[]> {
  return async (item) => {
    const result = await pi.exec("cat", [item.path], { cwd });
    if (result.code !== 0) {
      return [`Error reading file: ${result.stderr}`];
    }
    return loadFilePreviewWithShiki(item.path, result.stdout, theme);
  };
}
