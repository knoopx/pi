import type { KeyId } from "@mariozechner/pi-tui";
import { Key, matchesKey } from "@mariozechner/pi-tui";
import type { KeyPattern } from "./lib/types";

export interface KeyBinding<TContext = void> {
  key: KeyPattern;

  label?: string;

  handler: (ctx: TContext) => boolean | void | Promise<boolean | void>;

  when?: (ctx: TContext) => boolean;
}

interface NavigationState {
  index: number;
  maxIndex: number;
  pageSize?: number;
}

function formatKeyForHelp(key: KeyPattern): string {
  if (typeof key !== "string") return "";
  return key
    .replace("ctrl+", "ctrl+")
    .replace("up", "↑")
    .replace("down", "↓")
    .replace("pageUp", "pgup")
    .replace("pageDown", "pgdn")
    .replace("escape", "esc");
}

export function buildHelpFromBindings(bindings: KeyBinding[]): string {
  return bindings
    .filter((b) => b.label)
    .map((b) => `${formatKeyForHelp(b.key)} ${b.label}`)
    .join("  ");
}

export function filterActiveBindings<TContext>(
  bindings: KeyBinding<TContext>[],
  ctx?: TContext,
): KeyBinding<TContext>[] {
  return bindings.filter((b) => {
    if (!b.label) return false;
    if (b.when && ctx != null && !b.when(ctx)) return false;
    return true;
  });
}

interface KeyboardHandlerConfig<TContext = void> {
  bindings?: KeyBinding<TContext>[];

  navigation?: () => NavigationState;

  onNavigate?: (newIndex: number) => void;

  onEscape?: () => void;

  onEnter?: () => void;

  onTextInput?: (char: string) => void;

  onBackspace?: () => void;

  getContext?: () => TContext;
}

function handleCustomBindings<TContext>(
  data: string,
  bindings: KeyBinding<TContext>[],
  ctx: TContext,
): boolean {
  for (const binding of bindings) {
    if (!tryMatchBinding(data, binding, ctx)) continue;
    const result = binding.handler(ctx);
    if (result === true || result === undefined) return true;
    // Async handlers return a Promise — treat as successfully handled,
    // and prevent unhandled rejection since caller uses void
    if (result instanceof Promise) {
      result.catch(() => {});
      return true;
    }
  }
  return false;
}

function tryMatchBinding<TContext>(
  data: string,
  binding: KeyBinding<TContext>,
  ctx: TContext,
): boolean {
  if (typeof binding.key !== "string") return false;
  if (!matchesKey(data, binding.key as KeyId)) return false;
  if (binding.when && !binding.when(ctx)) return false;
  return true;
}

function handleNavigation(
  data: string,
  nav: NavigationState,
  onNavigate: (index: number) => void,
): boolean {
  const pageSize = nav.pageSize ?? 10;

  if (matchesKey(data, Key.up) && nav.index > 0) {
    onNavigate(nav.index - 1);
    return true;
  }

  if (matchesKey(data, Key.down) && nav.index < nav.maxIndex) {
    onNavigate(nav.index + 1);
    return true;
  }

  if (matchesKey(data, Key.pageUp)) {
    onNavigate(Math.max(0, nav.index - pageSize));
    return true;
  }

  if (matchesKey(data, Key.pageDown)) {
    onNavigate(Math.min(nav.maxIndex, nav.index + pageSize));
    return true;
  }

  return false;
}

function isPrintableChar(data: string): boolean {
  return data.length === 1 && data >= " " && data <= "~";
}

function buildEscapeHandler<TContext>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  return (data) => {
    if (matchesKey(data, "escape") && config.onEscape) {
      config.onEscape();
      return true;
    }
    return false;
  };
}

function buildEnterHandler<TContext>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  return (data) => {
    if (matchesKey(data, "enter") && config.onEnter) {
      config.onEnter();
      return true;
    }
    return false;
  };
}

function buildNavigationHandler<TContext>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  return (data) => {
    if (!config.navigation || !config.onNavigate) return false;
    return handleNavigation(data, config.navigation(), config.onNavigate);
  };
}

function buildBackspaceHandler<TContext>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  return (data) => {
    if ((data === "\x7f" || data === "\b") && config.onBackspace) {
      config.onBackspace();
      return true;
    }
    return false;
  };
}

function buildTextInputHandler<TContext>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  return (data) => {
    if (isPrintableChar(data) && config.onTextInput) {
      config.onTextInput(data);
      return true;
    }
    return false;
  };
}

export function createKeyboardHandler<TContext = void>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  const handlers: Array<(data: string) => boolean> = [];

  if (config.bindings) {
    const ctx = config.getContext?.() as TContext;
    const bindings = config.bindings;
    handlers.push((data) => handleCustomBindings(data, bindings, ctx));
  }

  if (config.onEscape) handlers.push(buildEscapeHandler(config));
  if (config.onEnter) handlers.push(buildEnterHandler(config));
  if (config.navigation && config.onNavigate)
    handlers.push(buildNavigationHandler(config));
  if (config.onBackspace) handlers.push(buildBackspaceHandler(config));
  if (config.onTextInput) handlers.push(buildTextInputHandler(config));

  return (data: string): boolean => {
    for (const handler of handlers) {
      if (handler(data)) return true;
    }
    return false;
  };
}

export const ACTION_KEYS = {
  delete: Key.ctrl("d") as KeyPattern,
} as const;
