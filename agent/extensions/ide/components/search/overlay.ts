import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createSearchComponent } from "./component";
import type { SearchResult } from "./types";
import { FULL_OVERLAY_OPTIONS } from "../../lib/ui/overlay";

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
    FULL_OVERLAY_OPTIONS,
  );
}
