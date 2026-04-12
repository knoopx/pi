/**
 * Navigation stack for overlay history.
 * Escape pops to previous screen instead of closing all.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import {
  createSymbolReferenceComponent,
  SYMBOL_REFERENCE_COMMANDS,
  type SymbolReferenceResult,
  type SymbolReferenceActionType,
  type SymbolReferenceItem,
} from "../components/symbol-references";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

type ScreenFactory<T> = (
  pi: ExtensionAPI,
  _ctx: ExtensionContext,
) => Promise<{
  result: T | null;
  action?: SymbolReferenceActionType;
  target?: string;
}>;

interface NavScreen {
  factory: ScreenFactory<unknown>;
}

async function handleDeleteAction(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  target: string,
): Promise<void> {
  try {
    await pi.exec("trash", [target], { cwd: ctx.cwd });
    ctx.ui.notify(`Deleted: ${target}`, "info");
  } catch (error) {
    ctx.ui.notify(
      `Failed to delete: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
  }
}

function createSymbolReferenceCommandScreen(
  cmDef: (typeof SYMBOL_REFERENCE_COMMANDS)[SymbolReferenceActionType],
  target: string,
  ctx: ExtensionContext,
): ScreenFactory<SymbolReferenceItem | null> {
  return async (pi) => {
    const cmResult = await ctx.ui.custom<SymbolReferenceResult | null>(
      (tui, theme, keybindings, done) =>
        createSymbolReferenceComponent(pi, tui, theme, keybindings, done, {
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
  };
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
      // Handle delete action
      if (action === "delete") {
        await handleDeleteAction(pi, ctx, target);
        continue;
      }

      const cmDef = SYMBOL_REFERENCE_COMMANDS[action];
      if (cmDef) {
        stack.push({
          factory: createSymbolReferenceCommandScreen(cmDef, target, ctx),
        });
      }
      continue;
    }

    return result as T;
  }

  return null;
}
