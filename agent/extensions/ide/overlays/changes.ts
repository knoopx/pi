/**
 * Changes browser overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createChangesComponent } from "../components/changes";
import {
  createSymbolReferenceComponent,
  SYMBOL_REFERENCE_COMMANDS,
  type SymbolReferenceResult,
} from "../components/symbol-references";
import {
  FULL_OVERLAY_OPTIONS,
  type SymbolReferenceActionResult,
} from "./options";

export async function openChangesBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  promptAndSetBookmark: (changeId: string) => Promise<string | null>,
): Promise<void> {
  const showChanges = async (): Promise<SymbolReferenceActionResult | null> => {
    let pendingCmAction: SymbolReferenceActionResult | null = null;

    await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
      return createChangesComponent(
        { pi, tui, theme, keybindings, cwd: ctx.cwd },
        done,
        (text) => {
          ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
        },
        (changeId) => promptAndSetBookmark(changeId),
        async (filePath, action) => {
          pendingCmAction = { filePath, action };
          done();
        },
      );
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
          createSymbolReferenceComponent(pi, tui, theme, keybindings, done, {
            title: cmDef.titleFn(cmAction.filePath),
            command: cmDef.command,
            args: cmDef.argsFn(cmAction.filePath),
            cwd: ctx.cwd,
          }),
        FULL_OVERLAY_OPTIONS,
      );
  }
}
