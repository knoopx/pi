import { Key, matchesKey } from "@earendil-works/pi-tui";
import type { KeyId } from "@earendil-works/pi-tui";
import type { KeyBinding } from "./bindings";

interface NavigationState {
  index: number;
  maxIndex: number;
  pageSize?: number;
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

export function handleCustomBindings<TContext>(
  data: string,
  bindings: KeyBinding<TContext>[],
  ctx: TContext,
): boolean {
  for (const binding of bindings) {
    if (!tryMatchBinding(data, binding, ctx)) continue;
    const result = binding.handler(ctx);
    if (result === true || result === undefined) return true;
    if (result instanceof Promise) {
      void result.catch(() => {});
      return true;
    }
  }
  return false;
}

export function buildEscapeHandler(
  onEscape: () => void,
): (data: string) => boolean {
  return (data) => {
    if (matchesKey(data, "escape")) {
      onEscape();
      return true;
    }
    return false;
  };
}

export function buildEnterHandler(
  onEnter: () => void,
): (data: string) => boolean {
  return (data) => {
    if (matchesKey(data, "enter")) {
      onEnter();
      return true;
    }
    return false;
  };
}

export function buildNavigationHandler(
  navigation: () => NavigationState,
  onNavigate: (index: number) => void,
): (data: string) => boolean {
  return (data) => handleNavigation(data, navigation(), onNavigate);
}

export function buildBackspaceHandler(
  onBackspace: () => void,
): (data: string) => boolean {
  return (data) => {
    if (data === "\x7f" || data === "\b") {
      onBackspace();
      return true;
    }
    return false;
  };
}

function isPrintableChar(data: string): boolean {
  return data.length === 1 && data >= " " && data <= "~";
}

export function buildTextInputHandler(
  onTextInput: (char: string) => void,
): (data: string) => boolean {
  return (data) => {
    if (isPrintableChar(data)) {
      onTextInput(data);
      return true;
    }
    return false;
  };
}
