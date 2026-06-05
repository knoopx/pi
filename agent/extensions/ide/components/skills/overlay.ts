import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createSkillsComponent } from "./component";
import type { SkillInfo } from "./types";
import { FULL_OVERLAY_OPTIONS } from "../../lib/ui/overlay";

export async function openSkillsPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await ctx.ui.custom<SkillInfo | null>(
    (tui, theme, keybindings, done) =>
      createSkillsComponent({
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

  if (result) {
    ctx.ui.pasteToEditor(`/skill:${result.name}`);
  }
}
