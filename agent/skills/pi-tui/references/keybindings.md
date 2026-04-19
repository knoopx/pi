# Keybindings Reference

## Global Keybinding Registry

Downstream packages can add custom keybindings via declaration merging on the `Keybindings` interface:

```typescript
interface Keybindings {
  "tui.editor.cursorUp": true;
  "tui.editor.cursorDown": true;
  "tui.editor.cursorLeft": true;
  "tui.editor.cursorRight": true;
  "tui.editor.cursorWordLeft": true;
  "tui.editor.cursorWordRight": true;
  "tui.editor.cursorLineStart": true;
  "tui.editor.cursorLineEnd": true;
  "tui.editor.jumpForward": true;
  "tui.editor.jumpBackward": true;
  "tui.editor.pageUp": true;
  "tui.editor.pageDown": true;
  "tui.editor.deleteCharBackward": true;
  "tui.editor.deleteCharForward": true;
  "tui.editor.deleteWordBackward": true;
  "tui.editor.deleteWordForward": true;
  "tui.editor.deleteToLineStart": true;
  "tui.editor.deleteToLineEnd": true;
  "tui.editor.yank": true;
  "tui.editor.yankPop": true;
  "tui.editor.undo": true;
  "tui.input.newLine": true;
  "tui.input.submit": true;
  "tui.input.tab": true;
  "tui.input.copy": true;
  "tui.select.up": true;
  "tui.select.down": true;
  "tui.select.pageUp": true;
  "tui.select.pageDown": true;
  "tui.select.confirm": true;
  "tui.select.cancel": true;
}
```

## TUI_KEYBINDINGS (Default Definitions)

```typescript
const TUI_KEYBINDINGS: Record<
  string,
  { defaultKeys: KeyId | KeyId[]; description?: string }
> = {
  "tui.editor.cursorUp": { defaultKeys: "up" },
  "tui.editor.cursorDown": { defaultKeys: "down" },
  "tui.editor.cursorLeft": { defaultKeys: ["left", "ctrl+b"] },
  "tui.editor.cursorRight": { defaultKeys: ["right", "ctrl+f"] },
  "tui.editor.cursorWordLeft": {
    defaultKeys: ["alt+left", "ctrl+left", "alt+b"],
  },
  "tui.editor.cursorWordRight": {
    defaultKeys: ["alt+right", "ctrl+right", "alt+f"],
  },
  "tui.editor.cursorLineStart": { defaultKeys: ["home", "ctrl+a"] },
  "tui.editor.cursorLineEnd": { defaultKeys: ["end", "ctrl+e"] },
  "tui.editor.jumpForward": { defaultKeys: "ctrl+]" },
  "tui.editor.jumpBackward": { defaultKeys: "ctrl+alt+]" },
  "tui.editor.pageUp": { defaultKeys: "pageUp" },
  "tui.editor.pageDown": { defaultKeys: "pageDown" },
  "tui.editor.deleteCharBackward": { defaultKeys: "backspace" },
  "tui.editor.deleteCharForward": { defaultKeys: ["delete", "ctrl+d"] },
  "tui.editor.deleteWordBackward": { defaultKeys: ["ctrl+w", "alt+backspace"] },
  "tui.editor.deleteWordForward": { defaultKeys: ["alt+d", "alt+delete"] },
  "tui.editor.deleteToLineStart": { defaultKeys: "ctrl+u" },
  "tui.editor.deleteToLineEnd": { defaultKeys: "ctrl+k" },
  "tui.editor.yank": { defaultKeys: "ctrl+y" },
  "tui.editor.yankPop": { defaultKeys: "alt+y" },
  "tui.editor.undo": { defaultKeys: "ctrl+-" },
  "tui.input.newLine": { defaultKeys: "shift+enter" },
  "tui.input.submit": { defaultKeys: "enter" },
  "tui.input.tab": { defaultKeys: "tab" },
  "tui.input.copy": { defaultKeys: "ctrl+c" },
  "tui.select.up": { defaultKeys: "up" },
  "tui.select.down": { defaultKeys: "down" },
  "tui.select.pageUp": { defaultKeys: "pageUp" },
  "tui.select.pageDown": { defaultKeys: "pageDown" },
  "tui.select.confirm": { defaultKeys: "enter" },
  "tui.select.cancel": { defaultKeys: ["escape", "ctrl+c"] },
};
```

## KeybindingsManager

Manages keybinding definitions and user overrides:

```typescript
interface KeybindingDefinition {
  defaultKeys: KeyId | KeyId[];
  description?: string;
}
type KeybindingDefinitions = Record<string, KeybindingDefinition>;
type KeybindingsConfig = Record<string, KeyId | KeyId[] | undefined>;

class KeybindingsManager {
  constructor(
    definitions: KeybindingDefinitions,
    userBindings?: KeybindingsConfig,
  );

  matches(data: string, keybinding: Keybinding): boolean; // Check if data matches a named binding
  getKeys(keybinding: Keybinding): KeyId[]; // Get resolved keys for a binding
  getDefinition(keybinding: Keybinding): KeybindingDefinition; // Get the definition for a binding
  getConflicts(): KeybindingConflict[]; // Find conflicting key assignments
  setUserBindings(userBindings: KeybindingsConfig): void; // Apply user overrides
  getUserBindings(): KeybindingsConfig; // Get current user overrides
  getResolvedBindings(): KeybindingsConfig; // Get definitions merged with user overrides
}

interface KeybindingConflict {
  key: KeyId; // The conflicting key combination
  keybindings: string[]; // Names of bindings that use this key
}
```

## Global Registry Functions

```typescript
function setKeybindings(keybindings: KeybindingsManager): void; // Set global keybindings manager
function getKeybindings(): KeybindingsManager; // Get the global keybindings manager
```

Set once at app startup. All built-in components (Editor, Input, SelectList) use the global manager via `matchesKey()` internally when custom bindings are configured.

## Customizing Keybindings

Create a `KeybindingsManager` with your definitions and user overrides:

```typescript
const myBindings = new KeybindingsManager(TUI_KEYBINDINGS, {
  "tui.editor.cursorLeft": ["ctrl+b", "h"], // Add 'h' as alternative to left
  "tui.editor.cursorRight": ["ctrl+f", "l"], // Add 'l' as alternative to right
  "tui.select.cancel": ["escape", "q"], // Add 'q' as cancel for selection lists
});
setKeybindings(myBindings);
```

User bindings override defaults. Set a binding to `undefined` to disable it entirely.

## Debug Key

Shift+Ctrl+D triggers the global debug callback on TUI: `tui.onDebug = () => console.log("Debug triggered")`. Called before input is forwarded to the focused component.
