import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createDirectoriesComponent } from "./component";
import type { DirectoryInfo } from "./types";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

export async function openDirectoriesPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await ctx.ui.custom<DirectoryInfo | null>(
    (tui, theme, keybindings, done) =>
      createDirectoriesComponent({
        pi,
        tui,
        theme,
        keybindings,
        done,
        initialQuery,
        ctx,
      }),
    OVERLAY_OPTIONS,
  );

  if (result) {
    ctx.ui.pasteToEditor(result.path);
  }
}
