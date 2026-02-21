/**
 * Skill browser overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createSkillBrowserComponent } from "../components/skill-browser";

export async function openSkillBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await ctx.ui.custom<string | undefined>(
    (tui, theme, keybindings, done) => {
      return createSkillBrowserComponent(
        pi,
        tui,
        theme,
        keybindings,
        done,
        initialQuery,
        ctx,
      );
    },
    {
      overlay: true,
      overlayOptions: { width: "95%" as const, anchor: "center" as const },
    },
  );

  if (result) {
    ctx.ui.setEditorText(result);
  }
}
