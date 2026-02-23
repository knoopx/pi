/**
 * Shared keyboard handling utilities for overlay components.
 *
 * Provides a declarative way to define keyboard shortcuts and reduces
 * boilerplate across list pickers, browsers, and form components.
 */

import { Key, matchesKey } from "@mariozechner/pi-tui";

export type KeyPattern = Parameters<typeof matchesKey>[1];

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
  // Convert key patterns to display format
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

export interface KeyboardHandlerConfig<TContext = void> {
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
export function createKeyboardHandler<TContext = void>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  return (data: string): boolean => {
    const ctx = config.getContext?.() as TContext;

    // 1. Check custom bindings first
    if (config.bindings) {
      for (const binding of config.bindings) {
        if (matchesKey(data, binding.key)) {
          if (binding.when && !binding.when(ctx)) {
            continue;
          }
          const result = binding.handler(ctx);
          if (result === true || result === undefined) {
            return true;
          }
        }
      }
    }

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
      const nav = config.navigation();

      if (matchesKey(data, "up") && nav.index > 0) {
        config.onNavigate(nav.index - 1);
        return true;
      }

      if (matchesKey(data, "down") && nav.index < nav.maxIndex) {
        config.onNavigate(nav.index + 1);
        return true;
      }

      const pageSize = nav.pageSize ?? 10;

      if (matchesKey(data, "pageUp")) {
        config.onNavigate(Math.max(0, nav.index - pageSize));
        return true;
      }

      if (matchesKey(data, "pageDown")) {
        config.onNavigate(Math.min(nav.maxIndex, nav.index + pageSize));
        return true;
      }
    }

    // 5. Backspace
    if ((data === "\x7f" || data === "\b") && config.onBackspace) {
      config.onBackspace();
      return true;
    }

    // 6. Printable characters
    if (data.length === 1 && data >= " " && data <= "~" && config.onTextInput) {
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
