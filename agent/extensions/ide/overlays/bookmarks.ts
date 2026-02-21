/**
 * Bookmarks browser overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createBookmarksComponent } from "../components/bookmarks";

export async function openBookmarksBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom(
    (tui, theme, keybindings, done) => {
      return createBookmarksComponent(
        pi,
        tui,
        theme,
        keybindings,
        done,
        ctx.cwd,
        (text) => {
          ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
        },
      );
    },
    {
      overlay: true,
      overlayOptions: { width: "95%" as const, anchor: "center" as const },
    },
  );
}
