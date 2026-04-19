import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createChangesComponent } from "./index";
import { createSymbolReferenceComponent } from "../symbol-references/component";
import type {
  SymbolReferenceResult,
  SymbolReferenceActionResult,
} from "../symbol-references/types";
import { SYMBOL_REFERENCE_COMMANDS } from "../symbol-references/types";
import { FULL_OVERLAY_OPTIONS } from "../../lib/overlay-utils";

export async function openChangesBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  promptAndSetBookmark: (changeId: string) => Promise<string | null>,
): Promise<void> {
  const showChanges = async (): Promise<SymbolReferenceActionResult | null> => {
    let pendingCmAction: SymbolReferenceActionResult | null = null;

    await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
      return createChangesComponent({
        init: { pi, tui, theme, keybindings, ctx },
        finish: done,
        onInsert: (text) => {
          ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
        },
        onBookmark: (changeId) => promptAndSetBookmark(changeId),
        onFileCmAction: (filePath, action) => {
          pendingCmAction = { filePath, action };
          done();
        },
      });
    }, FULL_OVERLAY_OPTIONS);

    return pendingCmAction;
  };

  while (true) {
    const cmAction = await showChanges();

    if (!cmAction) break;

    const cmDef = SYMBOL_REFERENCE_COMMANDS[cmAction.action];
    if (cmDef)
      await ctx.ui.custom<SymbolReferenceResult | null>(
        (tui, theme, keybindings, done) =>
          createSymbolReferenceComponent({
            pi,
            tui,
            theme,
            keybindings,
            done,
            config: {
              title: cmDef.titleFn(cmAction.filePath),
              command: cmDef.command,
              args: cmDef.argsFn(cmAction.filePath),
              ctx,
            },
          }),
        FULL_OVERLAY_OPTIONS,
      );
  }
}
