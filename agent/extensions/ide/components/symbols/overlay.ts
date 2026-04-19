import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type { SymbolResult } from "./types";
import { runNavigationStack } from "../symbol-references/navigation";
import { createSymbolsComponent } from "./component";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

export async function openSymbolsPicker(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialQuery: string,
): Promise<void> {
  const symbolResult = await runNavigationStack(pi, ctx, async (pi, ctx) => {
    const result = await ctx.ui.custom<SymbolResult | null>(
      (tui, theme, keybindings, done) =>
        createSymbolsComponent({
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
    if (!result) return { result: null };
    return {
      result: result.symbol,
      action: result.action,
      target: result.symbol.name,
    };
  });

  if (symbolResult) {
    const currentText = ctx.ui.getEditorText();
    const textToInsert = `${symbolResult.path}:${symbolResult.startLine}`;
    ctx.ui.setEditorText(currentText + textToInsert);
  }
}
