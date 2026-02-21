import type { Theme, ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Input } from "@mariozechner/pi-tui";
import { truncateAnsi, ensureWidth } from "./text-utils";
import { createKeyboardHandler } from "../keyboard";
import {
  borderedLine,
  topBorderWithTitle,
  horizontalSeparator,
} from "./ui/frame";
import { renderFormFieldContent, renderFormFooter } from "./ui/form";
import type { ArgsSection, CommandPaletteTui } from "./command-palette-types";

export interface ArgFormComponent {
  render: (width: number) => string[];
  handleInput: (data: string) => void;
  invalidate: () => void;
  dispose: () => void;
}

interface FieldState {
  input: Input;
  choices: string[];
  choiceIndex: number;
  isLoading: boolean;
  isSelector: boolean;
}

/** Execute shell command and return lines as choices */
async function loadDynamicChoices(
  pi: ExtensionAPI,
  command: string,
  cwd: string,
): Promise<string[]> {
  try {
    // Use sh -c to support pipes and redirects
    const result = await pi.exec("sh", ["-c", command], { cwd, timeout: 5000 });
    return result.stdout
      .split("\n")
      .map((line) => line.trim().replace(/^\*\s*/, "")) // Remove git branch marker
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

export function createArgFormComponent(
  pi: ExtensionAPI,
  args: ArgsSection,
  onDone: (result: Record<string, string>) => void,
  tui: CommandPaletteTui,
  theme: Theme,
): ArgFormComponent {
  const cwd = process.cwd();
  const fieldOrder: string[] = Object.keys(args);
  const fields = new Map<string, FieldState>();

  // Initialize field states
  for (const key of fieldOrder) {
    const def = args[key];
    const input = new Input();
    const state: FieldState = {
      input,
      choices: [],
      choiceIndex: -1,
      isLoading: false,
      isSelector: false,
    };

    // String = shell command, array = static choices
    if (typeof def.choices === "string") {
      state.isLoading = true;
      state.isSelector = true;
      const command = def.choices;
      void loadDynamicChoices(pi, command, cwd).then((choices) => {
        state.choices = choices;
        state.isLoading = false;
        // Set default to first choice if no default specified
        if (!def.default && choices.length > 0) {
          state.choiceIndex = 0;
          input.setValue(choices[0]);
        } else if (def.default) {
          state.choiceIndex = choices.indexOf(def.default);
          if (state.choiceIndex === -1 && choices.length > 0) {
            state.choiceIndex = 0;
            input.setValue(choices[0]);
          }
        }
        tui.requestRender();
      });
    } else if (Array.isArray(def.choices)) {
      state.choices = def.choices;
      state.isSelector = true;
      // Set choice index based on default or first choice
      if (def.default) {
        state.choiceIndex = def.choices.indexOf(def.default);
        if (state.choiceIndex === -1) state.choiceIndex = 0;
      } else if (def.choices.length > 0) {
        state.choiceIndex = 0;
        input.setValue(def.choices[0]);
      }
    }

    fields.set(key, state);
  }

  let focusedIndex = 0;

  function renderField(
    key: string,
    isFocused: boolean,
    innerWidth: number,
  ): string {
    const def = args[key];
    const state = fields.get(key)!;
    const inputValue = state.input.getValue();
    const value = inputValue || def.default || "";

    // Build label
    const labelWidth = 14;
    const label = def.description ? `${key}` : key;
    const labelText = ensureWidth(` ${label}:`, labelWidth);

    // Render value
    const valueWidth = innerWidth - labelWidth - 2;
    let valueText: string;

    if (state.isLoading) {
      valueText = theme.fg("dim", "Loading...");
    } else if (state.isSelector && state.choices.length > 0) {
      // Inline selector: ← value →
      if (isFocused) {
        valueText = `← ${value} →`;
      } else {
        valueText = value;
      }
    } else if (isFocused) {
      // Text input with cursor - show default dimmed if no input yet
      if (inputValue) {
        valueText = inputValue + theme.fg("accent", "▏");
      } else if (def.default) {
        valueText = theme.fg("dim", def.default) + theme.fg("accent", "▏");
      } else {
        valueText = theme.fg("accent", "▏");
      }
    } else {
      valueText = value || theme.fg("dim", "(empty)");
    }

    valueText = truncateAnsi(valueText, valueWidth);

    return renderFormFieldContent(
      theme,
      labelText,
      valueText,
      isFocused,
      innerWidth,
    );
  }

  function render(width: number): string[] {
    const lines: string[] = [];
    const innerWidth = width - 2;

    lines.push(topBorderWithTitle(theme, " Arguments ", innerWidth));

    // Render fields
    for (let i = 0; i < fieldOrder.length; i++) {
      const key = fieldOrder[i];
      const isFocused = i === focusedIndex;
      lines.push(
        borderedLine(
          theme,
          renderField(key, isFocused, innerWidth),
          innerWidth,
        ),
      );
    }

    lines.push(horizontalSeparator(theme, innerWidth));

    const currentState = fields.get(fieldOrder[focusedIndex]);
    const isSelector =
      currentState?.isSelector && currentState.choices.length > 0;
    const helpParts = isSelector
      ? ["←→ change", "↑↓ field", "enter submit", "esc cancel"]
      : ["↑↓ field", "enter submit", "esc cancel"];

    lines.push(...renderFormFooter(theme, innerWidth, ...helpParts));

    return lines;
  }

  const handleKeyboard = createKeyboardHandler({
    bindings: [
      {
        key: "tab",
        handler: () => {
          if (focusedIndex < fieldOrder.length - 1) {
            focusedIndex++;
            tui.requestRender();
          }
        },
      },
      {
        key: "left",
        handler: () => {
          const state = fields.get(fieldOrder[focusedIndex])!;
          if (state.isSelector && state.choices.length > 0) {
            state.choiceIndex =
              (state.choiceIndex - 1 + state.choices.length) %
              state.choices.length;
            state.input.setValue(state.choices[state.choiceIndex]);
            tui.requestRender();
            return true;
          }
          return false;
        },
      },
      {
        key: "right",
        handler: () => {
          const state = fields.get(fieldOrder[focusedIndex])!;
          if (state.isSelector && state.choices.length > 0) {
            state.choiceIndex = (state.choiceIndex + 1) % state.choices.length;
            state.input.setValue(state.choices[state.choiceIndex]);
            tui.requestRender();
            return true;
          }
          return false;
        },
      },
    ],
    navigation: () => ({
      index: focusedIndex,
      maxIndex: fieldOrder.length - 1,
    }),
    onNavigate: (newIndex) => {
      focusedIndex = newIndex;
      tui.requestRender();
    },
    onEscape: () => onDone({}),
    onEnter: () => {
      const result: Record<string, string> = {};
      for (const key of fieldOrder) {
        const inputValue = fields.get(key)!.input.getValue().trim();
        result[key] = inputValue || args[key].default || "";
      }
      onDone(result);
    },
  });

  function handleInput(data: string): void {
    if (handleKeyboard(data)) {
      return;
    }

    // Text input for non-selector fields
    const state = fields.get(fieldOrder[focusedIndex])!;
    if (!state.isSelector) {
      state.input.handleInput(data);
      tui.requestRender();
    }
  }

  function invalidate(): void {
    for (const state of fields.values()) {
      state.input.invalidate();
    }
  }

  return { render, handleInput, invalidate, dispose: () => {} };
}
