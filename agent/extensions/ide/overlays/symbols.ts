/**
 * Symbol picker overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  createSymbolsComponent,
  type SymbolResult,
} from "../components/symbols";
import { runNavigationStack } from "./navigation";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

export async function openSymbolsPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const result = await runNavigationStack(pi, ctx, async (pi, ctx) => {
    const symbolResult = await ctx.ui.custom<SymbolResult | null>(
      (tui, theme, keybindings, done) =>
        createSymbolsComponent(
          pi,
          tui,
          theme,
          keybindings,
          done,
          initialQuery,
          ctx.cwd,
        ),
      OVERLAY_OPTIONS,
    );
    if (!symbolResult) return { result: null };
    return {
      result: symbolResult.symbol,
      action: symbolResult.action,
      target: symbolResult.symbol.name,
    };
  });

  if (result) {
    const currentText = ctx.ui.getEditorText();
    ctx.ui.setEditorText(currentText + `${result.path}:${result.startLine}`);
  }
}
