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

export function createKeyboardHandler<TContext = void>(
  config: KeyboardHandlerConfig<TContext>,
): (data: string) => boolean {
  const handlers: Array<(data: string) => boolean> = [];

  if (config.bindings) {
    const ctx = config.getContext?.() as TContext;
    const bindings = config.bindings;
    handlers.push((data) => handleCustomBindings(data, bindings, ctx));
  }

  if (config.onEscape) handlers.push(buildEscapeHandler(config.onEscape));
  if (config.onEnter) handlers.push(buildEnterHandler(config.onEnter));
  if (config.navigation && config.onNavigate)
    handlers.push(buildNavigationHandler(config.navigation, config.onNavigate));
  if (config.onBackspace)
    handlers.push(buildBackspaceHandler(config.onBackspace));
  if (config.onTextInput)
    handlers.push(buildTextInputHandler(config.onTextInput));

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
