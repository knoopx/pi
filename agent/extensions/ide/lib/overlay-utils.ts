import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import type { ListPickerComponent } from "./list-picker";

interface ComponentCreatorOptions {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: unknown) => void;
  cwd: string;
  onInsert?: (text: string) => void;
}

type ComponentCreator = (
  options: ComponentCreatorOptions,
) => ListPickerComponent;

export const FULL_OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: {
    width: "95%" as const,
    anchor: "center" as const,
  },
};

export async function openBrowserOverlay(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  createComponent: ComponentCreator,
): Promise<void> {
  await ctx.ui.custom(
    (tui, theme, keybindings, done) => {
      return createComponent({
        pi,
        tui,
        theme,
        keybindings,
        done,
        cwd: ctx.cwd,
        onInsert: (text) => {
          ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
        },
      });
    },
    {
      overlay: true,
      overlayOptions: { width: "95%" as const, anchor: "center" as const },
    },
  );
}
