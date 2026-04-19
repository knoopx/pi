import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createOpLogComponent } from "./component";

export async function openOpLogBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<void> {
  await ctx.ui.custom(
    (tui, theme, keybindings, done) => {
      return createOpLogComponent({ pi, tui, theme, keybindings, done, cwd: ctx.cwd });
    },
    {
      overlay: true,
      overlayOptions: { width: "95%" as const, anchor: "center" as const },
    },
  );
}
