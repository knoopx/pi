/**
 * Navigation stack for overlay history.
 * Escape pops to previous screen instead of closing all.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  createCmResultsComponent,
  CM_COMMANDS,
  type CmResult,
  type CmActionType,
} from "../components/cm-results";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

type ScreenFactory<T> = (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
) => Promise<{ result: T | null; action?: CmActionType; target?: string }>;

interface NavScreen {
  factory: ScreenFactory<unknown>;
}

export async function runNavigationStack<T>(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  initialScreen: ScreenFactory<T>,
): Promise<T | null> {
  const stack: NavScreen[] = [
    { factory: initialScreen as ScreenFactory<unknown> },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const { result, action, target } = await current.factory(pi, ctx);

    if (result === null) {
      stack.pop();
      continue;
    }

    if (action && target) {
      const cmDef = CM_COMMANDS[action];
      if (cmDef) {
        stack.push({
          factory: async (pi, ctx) => {
            const cmResult = await ctx.ui.custom<CmResult | null>(
              (tui, theme, keybindings, done) =>
                createCmResultsComponent(pi, tui, theme, keybindings, done, {
                  title: cmDef.titleFn(target),
                  command: cmDef.command,
                  args: cmDef.argsFn(target),
                  cwd: ctx.cwd,
                }),
              OVERLAY_OPTIONS,
            );
            if (!cmResult) return { result: null };
            return {
              result: cmResult.item,
              action: cmResult.action,
              target: cmResult.item.name,
            };
          },
        });
      }
      continue;
    }

    return result as T;
  }

  return null;
}
