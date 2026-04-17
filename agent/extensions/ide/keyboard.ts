/**
 * Shared keyboard handling utilities for overlay components.
 *
 * Provides a declarative way to define keyboard shortcuts and reduces
 * boilerplate across list pickers, browsers, and form components.
 */

import type { KeyId } from "@mariozechner/pi-tui";
import { Key, matchesKey } from "@mariozechner/pi-tui";
import type { KeyPattern } from "./types";

export interface KeyBinding<TContext = void> {
  /** Key pattern to match (e.g., Key.ctrl("d"), "escape", "enter") */
  key: KeyPattern;
  /** Help label (e.g., "delete"). If provided, shown in help text. */
  label?: string;
  /** Handler function - return true to stop propagation */
  handler: (ctx: TContext) => boolean | void | Promise<boolean | void>;
  /** Optional condition to check before handling */
  when?: (ctx: TContext) => boolean;
}

interface NavigationState {
  index: number;
  maxIndex: number;
  pageSize?: number;
}

/** Format a key pattern for display in help text */
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

/** Build help text from bindings that have labels */
export function buildHelpFromBindings(bindings: KeyBinding[]): string {
  return bindings
    .filter((b) => b.label)
    .map((b) => `${formatKeyForHelp(b.key)} ${b.label}`)
    .join("  ");
}

/** Filter bindings to only include those with labels and passing the when condition */
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
  /** Custom key bindings (checked first) */
  bindings?: KeyBinding<TContext>[];
  /** Navigation state for arrow key handling */
  navigation?: () => NavigationState;
  /** Callback when navigation index changes */
  onNavigate?: (newIndex: number) => void;
  /** Callback for escape key */
  onEscape?: () => void;
  /** Callback for enter key */
  onEnter?: () => void;
  /** Callback for text input (printable characters) */
  onTextInput?: (char: string) => void;
  /** Callback for backspace */
  onBackspace?: () => void;
  /** Context passed to all handlers */
  getContext?: () => TContext;
}

/**
 * Creates a keyboard input handler with common patterns built-in.
 *
 * @example
 * ```ts
 * const handleInput = createKeyboardHandler({
 *   bindings: [
 *     { key: Key.ctrl("d"), handler: () => { deleteItem(); return true; } },
 *   ],
 *   navigation: () => ({ index: selectedIndex, maxIndex: items.length - 1 }),
 *   onNavigate: (i) => { selectedIndex = i; render(); },
 *   onEscape: () => done(),
 *   onEnter: () => selectItem(),
 * });
 * ```
 */
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

export function createKeyboardHandler<TContext = void>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  return (data: string): boolean => {
    const ctx = config.getContext?.() as TContext;

    // 1. Check custom bindings first
    if (config.bindings && handleCustomBindings(data, config.bindings, ctx))
      return true;

    // 2. Escape
    if (matchesKey(data, "escape") && config.onEscape) {
      config.onEscape();
      return true;
    }

    // 3. Enter
    if (matchesKey(data, "enter") && config.onEnter) {
      config.onEnter();
      return true;
    }

    // 4. Navigation
    if (config.navigation && config.onNavigate) {
      if (handleNavigation(data, config.navigation(), config.onNavigate))
        return true;
    }

    // 5. Backspace
    if ((data === "\x7f" || data === "\b") && config.onBackspace) {
      config.onBackspace();
      return true;
    }

    // 6. Printable characters
    if (isPrintableChar(data) && config.onTextInput) {
      config.onTextInput(data);
      return true;
    }

    return false;
  };
}

/**
 * Standard action keys for overlay components.
 * Only truly universal actions that apply across all contexts.
 */
export const ACTION_KEYS = {
  /** Destructive action: delete, drop, forget, discard */
  delete: Key.ctrl("d") as KeyPattern,
} as const;
