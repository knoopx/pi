/**
 * Changes browser overlay.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import { createChangesComponent } from "../components/changes";
import {
  createCmResultsComponent,
  CM_COMMANDS,
  type CmResult,
} from "../components/cm-results";
import { FULL_OVERLAY_OPTIONS, type CmActionResult } from "./options";

export async function openChangesBrowser(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  promptAndSetBookmark: (
    ctx: ExtensionContext,
    changeId: string,
  ) => Promise<string | null>,
): Promise<void> {
  const showChanges = async (): Promise<CmActionResult | null> => {
    let pendingCmAction: CmActionResult | null = null;

    await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
      return createChangesComponent(
        { pi, tui, theme, keybindings, cwd: ctx.cwd },
        done,
        (text) => {
          ctx.ui.setEditorText(ctx.ui.getEditorText() + text);
        },
        (changeId) => promptAndSetBookmark(ctx, changeId),
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

    const cmDef = CM_COMMANDS[cmAction.action];
    if (cmDef) {
      await ctx.ui.custom<CmResult | null>(
        (tui, theme, keybindings, done) =>
          createCmResultsComponent(pi, tui, theme, keybindings, done, {
            title: cmDef.titleFn(cmAction.filePath),
            command: cmDef.command,
            args: cmDef.argsFn(cmAction.filePath),
            cwd: ctx.cwd,
          }),
        FULL_OVERLAY_OPTIONS,
      );
    }
  }
}
