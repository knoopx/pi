import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createSearchComponent } from "./component";
import type { SearchResult } from "./types";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

export async function openSearchPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<SearchResult | null> {
  return await ctx.ui.custom<SearchResult | null>(
    (tui, theme, keybindings, done) =>
      createSearchComponent({
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
}
