/**
 * Command palette overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  AppKeybinding,
} from "@mariozechner/pi-coding-agent";
import type { KeyId } from "@mariozechner/pi-tui";
import { createCommandPaletteComponent } from "../components/command-palette";

export interface RegisteredShortcut {
  shortcut: KeyId;
  description?: string;
  execute: () => void;
}

export async function openCommandPalette(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  registeredShortcuts: RegisteredShortcut[],
): Promise<void> {
  await ctx.ui.custom<void>(
    (tui, theme, keybindings, done) => {
      return createCommandPaletteComponent(
        pi,
        tui,
        theme,
        keybindings,
        done,
        (command) => {
          pi.sendUserMessage(command);
        },
        (action: AppKeybinding) => {
          if (action === "app.interrupt") {
            ctx.abort();
          } else {
            const keys = keybindings.getKeys(action);
            const keyStr = keys.length > 0 ? keys[0] : "no keybinding";
            ctx.ui.notify(`Press ${keyStr} to ${action}`, "info");
          }
        },
        registeredShortcuts,
        ctx,
      );
    },
    {
      overlay: true,
      overlayOptions: {
        width: "70%",
        maxHeight: "60%",
        minWidth: 60,
        anchor: "center",
      },
    },
  );
}
