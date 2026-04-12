/**
 * Shared helper to open a browser-style overlay backed by a component creator.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import type { ListPickerComponent } from "../components/list-picker";

type ComponentCreator = (
  pi: ExtensionAPI,
  tui: { terminal: { rows: number }; requestRender: () => void },
  theme: Theme,
  keybindings: KeybindingsManager,
  done: (result: unknown) => void,
  cwd: string,
  onInsert?: (text: string) => void,
) => ListPickerComponent;

export async function openBrowserOverlay(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  createComponent: ComponentCreator,
): Promise<void> {
  await ctx.ui.custom(
    (tui, theme, keybindings, done) => {
      return createComponent(
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
