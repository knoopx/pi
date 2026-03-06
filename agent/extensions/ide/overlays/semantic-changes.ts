/**
 * Semantic changes overlay.
 *
 * Shows jj changes on the left, entity-level semantic diffs on the right.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createSemanticChangesComponent } from "../components/semantic-changes";
import { FULL_OVERLAY_OPTIONS } from "./options";

export async function openSemanticChangesBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
    return createSemanticChangesComponent(
      { pi, tui, theme, keybindings, cwd: ctx.cwd },
      done,
      (text) => {
        ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
      },
    );
  }, FULL_OVERLAY_OPTIONS);
}
