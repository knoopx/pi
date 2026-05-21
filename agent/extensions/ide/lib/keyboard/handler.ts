import type { KeyPattern } from "../../types";
import type { KeyBinding } from "./bindings";
import {
  handleCustomBindings,
  buildEscapeHandler,
  buildEnterHandler,
  buildNavigationHandler,
  buildBackspaceHandler,
  buildTextInputHandler,
} from "./builtins";

export {
  type KeyBinding,
  buildHelpFromBindings,
  filterActiveBindings,
} from "./bindings";

interface NavigationState {
  index: number;
  maxIndex: number;
  pageSize?: number;
}

export interface KeyboardHandlerConfig<TContext = void> {
  bindings?: KeyBinding<TContext>[];
  navigation?: () => NavigationState;
  onNavigate?: (newIndex: number) => void;
  onEscape?: () => void;
  onEnter?: () => void;
  onTextInput?: (char: string) => void;
  onBackspace?: () => void;
  getContext?: () => TContext;
}

type HandlerBuilder = (data: string) => boolean;

function buildHandlers<TContext>(
  config: KeyboardHandlerConfig<TContext>,
): HandlerBuilder[] {
  const ctx = config.getContext?.() as TContext;
  const bindings = config.bindings;
  const builders: Array<() => HandlerBuilder | null> = [
    () =>
      bindings
        ? (data: string) => handleCustomBindings(data, bindings, ctx)
        : null,
    () => (config.onEscape ? buildEscapeHandler(config.onEscape) : null),
    () => (config.onEnter ? buildEnterHandler(config.onEnter) : null),
    () =>
      config.navigation && config.onNavigate
        ? buildNavigationHandler(config.navigation, config.onNavigate)
        : null,
    () =>
      config.onBackspace ? buildBackspaceHandler(config.onBackspace) : null,
    () =>
      config.onTextInput ? buildTextInputHandler(config.onTextInput) : null,
  ];

  return builders.flatMap((build) => {
    const handler = build();
    return handler ? [handler] : [];
  });
}

export function createKeyboardHandler<TContext = void>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  const handlers = buildHandlers(config);

  return (data: string): boolean => {
    for (const handler of handlers) {
      if (handler(data)) return true;
    }
    return false;
  };
}

export const ACTION_KEYS = {
  delete: "ctrl+d" as KeyPattern,
} as const;
