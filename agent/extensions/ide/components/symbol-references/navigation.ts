import type {
  ExtensionAPI,
  ExtensionContext,
} from "@mariozechner/pi-coding-agent";
import type {
  SymbolReferenceItem,
  SymbolReferenceResult,
  SymbolReferenceActionType,
} from "./types";
import { SYMBOL_REFERENCE_COMMANDS } from "./types";
import { createSymbolReferenceComponent } from "./component";

const OVERLAY_OPTIONS = {
  overlay: true,
  overlayOptions: { width: "95%" as const, anchor: "center" as const },
};

type ScreenFactory<T> = (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
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
        createSymbolReferenceComponent({
          pi,
          tui,
          theme,
          keybindings,
          done,
          config: {
            title: cmDef.titleFn(target),
            command: cmDef.command,
            args: cmDef.argsFn(target),
            ctx,
          },
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
    const navResult = await current.factory(pi, ctx);

    const navigation = await handleNavigationStep(navResult, pi, ctx, stack);
    if (navigation.isFinal) return navigation.result as T;
  }

  return null;
}

function handleNavigationStep(
  navResult: {
    result: unknown;
    action?: string;
    target?: string;
  },
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  stack: NavScreen[],
): Promise<{ isFinal: boolean; result: unknown }> {
  const { result, action, target } = navResult;

  if (result === null) {
    stack.pop();
    return notFinal(null);
  }

  if (!action || !target) return final(result);

  return handleAction(action, target, { pi, ctx, stack });
}

interface NavigationCtx {
  pi: ExtensionAPI;
  ctx: ExtensionContext;
  stack: NavScreen[];
}

function notFinal(
  result: unknown,
): Promise<{ isFinal: boolean; result: unknown }> {
  return Promise.resolve({ isFinal: false, result });
}

function final(
  result: unknown,
): Promise<{ isFinal: boolean; result: unknown }> {
  return Promise.resolve({ isFinal: true, result });
}

async function handleAction(
  action: string,
  target: string,
  ctx: NavigationCtx,
): Promise<{ isFinal: boolean; result: unknown }> {
  if (action === "delete") {
    await handleDeleteAction(ctx.pi, ctx.ctx, target);
    return notFinal(null);
  }

  const cmDef = SYMBOL_REFERENCE_COMMANDS[action as SymbolReferenceActionType];
  if (cmDef) {
    ctx.stack.push({
      factory: createSymbolReferenceCommandScreen(cmDef, target, ctx.ctx),
    });
    return notFinal(null);
  }

  return final(null);
}
