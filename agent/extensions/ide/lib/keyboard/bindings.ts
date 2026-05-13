import type { KeyPattern } from "../../types";

export interface KeyBinding<TContext = void> {
  key: KeyPattern;
  label?: string;
  handler: (ctx: TContext) => boolean | void | Promise<boolean | void>;
  when?: (ctx: TContext) => boolean;
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

type NavigationDirection = "up" | "down" | "pageUp" | "pageDown";

export function createNavigationBindings(
  onNavigate: (direction: NavigationDirection) => void,
  options?: { label?: string },
): KeyBinding[] {
  const label = options?.label ?? "nav";
  return [
    {
      key: "up",
      label,
      handler: () => onNavigate("up"),
    },
    {
      key: "down",
      handler: () => onNavigate("down"),
    },
    {
      key: "pageUp",
      handler: () => onNavigate("pageUp"),
    },
    {
      key: "pageDown",
      handler: () => onNavigate("pageDown"),
    },
  ];
}
