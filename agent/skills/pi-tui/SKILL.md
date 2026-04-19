---
name: "pi-tui"
description: "Builds terminal UI components with @mariozechner/pi-tui using a component-based architecture. Use when creating TUI screens, building interactive input widgets, rendering markdown or images, managing overlays, or wiring keybindings."
---

# pi-tui — Component-Based Terminal UI

Component-based TUI framework with differential rendering and synchronized output for flicker-free terminals.

## Core Architecture

All components implement the `Component` interface:

```typescript
import { TUI, ProcessTerminal } from "@mariozechner/pi-tui";

const tui = new TUI(new ProcessTerminal());
tui.addChild(component); // any Component
tui.start(); // starts rendering loop
tui.stop(); // stops and drains input
```

Every `render(width)` line must not exceed `width` visible columns. Use `truncateToWidth()`, `wrapTextWithAnsi()`, or `visibleWidth()` to enforce this. Each rendered line gets a full SGR reset appended — styles do not carry across lines.

## Built-in Components (13 total, one per file)

| Component           | Constructor Signature                                                      | Key Methods                                                                        |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Container`         | `new Container()`                                                          | `addChild()`, `removeChild()`, `clear()`, `children: Component[]`                  |
| `Text`              | `new Text(text?, paddingX?, paddingY?, customBgFn?)`                       | `setText()`, `setCustomBgFn()`                                                     |
| `TruncatedText`     | `new TruncatedText(text, paddingX?, paddingY?)`                            | Fixed single-line truncation                                                       |
| `Input`             | `new Input()`                                                              | `getValue()`, `setValue()`, `focused` (Focusable)                                  |
| `Editor`            | `new Editor(tui, theme, options?)`                                         | `setText()`, `getText()`, `getLines()`, `getCursor()`, `setAutocompleteProvider()` |
| `Markdown`          | `new Markdown(text, paddingX, paddingY, theme, defaultTextStyle?)`         | `setText()`                                                                        |
| `SelectList`        | `new SelectList(items, maxVisible, theme, layout?)`                        | `setFilter()`, `getSelectedItem()`, `onSelect`, `onCancel`                         |
| `SettingsList`      | `new SettingsList(items, maxVisible, theme, onChange, onCancel, options?)` | `updateValue()`                                                                    |
| `Box`               | `new Box(paddingX?, paddingY?, bgFn?)`                                     | `setBgFn()`, child management                                                      |
| `Spacer`            | `new Spacer(lines?)`                                                       | `setLines()`                                                                       |
| `Loader`            | `new Loader(tui, spinnerColorFn, messageColorFn, message?, indicator?)`    | `start()`, `stop()`, `setMessage()`, `setIndicator()`                              |
| `CancellableLoader` | Extends `Loader`                                                           | `signal` (AbortSignal), `aborted`, `onAbort`, `dispose()`                          |
| `Image`             | `new Image(base64Data, mimeType, theme, options?, dimensions?)`            | `getImageId()`                                                                     |

Each component is its own file — no barrel re-exports. Import directly from the package.

## Focusable Components (IME Support)

`Input`, `Editor` implement `Focusable`. Custom components with cursors must also:

1. Implement `Focusable` with a `focused: boolean` getter/setter
2. Emit `CURSOR_MARKER` in render output when focused

When a container wraps an Input/Editor, propagate focus to the child for correct IME candidate window positioning.

## Key Detection

Use `matchesKey()` with `Key` helper (supports Kitty protocol): `matchesKey(data, Key.enter)`, `Key.ctrl("c")`, `Key.shift("tab")`, `Key.alt("left")`, `Key.ctrlShift("p")`. See references/keys.md for full key identifier list.

## Overlays

Show overlays with configurable positioning: `tui.showOverlay(component, options)`. Position resolution order: absolute `row`/`col` > percentage `row`/`col` > `anchor`. Use `handle.hide()` (permanent), `handle.setHidden()` (temp), `handle.focus()`/`unfocus()`. Overlays support `nonCapturing` mode (no keyboard focus steal) and a `visible` callback for dimension-aware visibility. Multiple overlays stack with z-ordering by `focusOrder`.

## Keybindings

Components use the global `KeybindingsManager` via `getKeybindings()` — not raw `matchesKey()`. This allows user-customizable key assignments. Override defaults at startup: `setKeybindings(new KeybindingsManager(TUI_KEYBINDINGS, userOverrides))`. Components like `Editor`, `Input`, `SelectList`, and `SettingsList` all route input through named bindings (e.g., `tui.editor.cursorLeft`, `tui.select.cancel`).

## Custom Component Pattern

Each custom component lives in its own file implementing `Component`. For caching, store `cachedLines` and `cachedWidth`, reset in `invalidate()`. See references/components.md for all constructors, properties, and themes.

See [complete API reference](references/api.md) for TUI/Container/Overlay types, [components](references/components.md) for full component APIs with all methods/themes, [custom components](references/custom-components.md) for coding-agent patterns (DynamicBorder, BorderedLoader, CustomEditor, etc.), [autocomplete](references/autocomplete.md) for providers and fuzzy matching, [keys](references/keys.md) for keyboard handling, [keybindings](references/keybindings.md) for customization, [terminal-image](references/terminal-image.md) for image APIs, [utils](references/utils.md) for text utilities, [examples](references/examples.md) for practical code patterns, [best practices](references/best-practices.md) for architectural guidelines, [anti-patterns](references/anti-patterns.md) for common mistakes and how to avoid them.
