import { matchesKey } from "@mariozechner/pi-tui";

/**
 * Creates a key matcher function for input handling.
 */
function createKeyMatcher(
  data: string,
): (key: Parameters<typeof matchesKey>[1]) => boolean {
  const normalized = data.toLowerCase();
  return (key: Parameters<typeof matchesKey>[1]) =>
    matchesKey(data, key) || normalized === key;
}

/**
 * Handles escape/q key to close the component.
 */
function handleEscape(
  matches: ReturnType<typeof createKeyMatcher>,
  done: () => void,
): boolean {
  if (matches("escape") || matches("q")) {
    done();
    return true;
  }
  return false;
}

/**
 * Helper to handle common key bindings for usage components.
 */
export function handleUsageInput(
  data: string,
  opts: {
    done: () => void;
    onTabForward: () => void;
    onTabBackward: () => void;
    onUp: () => void;
    onDown: () => void;
    onEnter?: () => void;
  },
): void {
  const matches = createKeyMatcher(data);

  if (handleEscape(matches, opts.done)) return;

  if (matches("tab") || matches("right")) opts.onTabForward();
  else if (matches("shift+tab") || matches("left")) opts.onTabBackward();
  else if (matches("up")) opts.onUp();
  else if (matches("down")) opts.onDown();
  else if (opts.onEnter && (matches("enter") || matches("space")))
    opts.onEnter();
}
