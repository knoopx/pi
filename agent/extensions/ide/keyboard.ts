/**
 * Shared keyboard handling utilities for overlay components.
 *
 * Provides a declarative way to define keyboard shortcuts and reduces
 * boilerplate across list pickers, browsers, and form components.
 */

import { matchesKey } from "@mariozechner/pi-tui";

export type KeyPattern = Parameters<typeof matchesKey>[1];

export interface KeyBinding<TContext = void> {
  /** Key pattern to match (e.g., "ctrl+d", "escape", "enter") */
  key: KeyPattern;
  /** Handler function - return true to stop propagation */
  handler: (ctx: TContext) => boolean | void | Promise<boolean | void>;
  /** Optional condition to check before handling */
  when?: (ctx: TContext) => boolean;
}

export interface NavigationState {
  index: number;
  maxIndex: number;
  pageSize?: number;
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
 *     { key: "ctrl+d", handler: () => { deleteItem(); return true; } },
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
 * Standard navigation bindings for list-based components.
 */
export const NAVIGATION_KEYS: KeyPattern[] = [
  "up",
  "down",
  "pageUp",
  "pageDown",
];

/**
 * Check if a key is a navigation key.
 */
export function isNavigationKey(data: string): boolean {
  return NAVIGATION_KEYS.some((key) => matchesKey(data, key));
}

/**
 * Standard help text for common shortcuts.
 */
export const COMMON_HELP = {
  navigation: "↑↓ navigate",
  select: "enter select",
  close: "esc close",
  filter: "ctrl+/ filter",
  tab: "tab switch",
  page: "pgup/pgdn scroll",
} as const;

/**
 * Build help text from shortcut descriptions.
 */
export function buildShortcutHelp(
  shortcuts: { key: string; label: string }[],
): string {
  return shortcuts.map((s) => `${s.key} ${s.label}`).join("  ");
}
