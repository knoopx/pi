/**
 * File picker overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createFilesComponent, type FileResult } from "../components/files";
import { runNavigationStack } from "./navigation";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

export async function openFilesPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await runNavigationStack(pi, ctx, async (pi, ctx) => {
    const fileResult = await ctx.ui.custom<FileResult | null>(
      (tui, theme, keybindings, done) =>
        createFilesComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          initialQuery,
          ctx.cwd,
        ),
      OVERLAY_OPTIONS,
    );
    if (!fileResult) return { result: null };
    return {
      result: fileResult.file,
      action: fileResult.action,
      target: fileResult.file.path,
    };
  });

  if (result) {
    const currentText = ctx.ui.getEditorText();
    ctx.ui.setEditorText(currentText + result.path);
  }
}
