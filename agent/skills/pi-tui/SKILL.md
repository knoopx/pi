---
name: "pi-tui"
description: "Builds terminal UI components with @mariozechner/pi-tui using a component-based architecture. Use when creating TUI screens, building interactive input widgets, rendering markdown or images, managing overlays, or wiring keybindings."
---

# pi-tui — Component-Based Terminal UI

Component-based TUI framework with differential rendering and synchronized output for flicker-free terminals.

## Core Setup

```typescript
import { TUI, ProcessTerminal } from "@mariozechner/pi-tui";

const tui = new TUI(new ProcessTerminal());
tui.addChild(component); // any Component
tui.start(); // starts rendering loop
tui.stop(); // stops and drains input
```

## Built-in Components (13 total)

| Component                      | Purpose                        | Key Methods                              |
| ------------------------------ | ------------------------------ | ---------------------------------------- |
| `Container`                    | Holds child components         | `addChild()`, `removeChild()`, `clear()` |
| `Text` / `TruncatedText`       | Plain text display             | `setText()`                              |
| `Input`                        | Single-line text input         | `getValue()`, `setValue()`               |
| `Editor`                       | Multi-line text editor         | `setText()`, `getText()`, `getCursor()`  |
| `Markdown`                     | Render markdown text           | `setText()`                              |
| `SelectList`                   | Selectable list with filtering | `setFilter()`, `onSelect`, `onCancel`    |
| `SettingsList`                 | Key-value settings editor      | `updateValue()`                          |
| `Box`                          | Container with background      | `setBgFn()`                              |
| `Spacer`                       | Vertical spacing               | `setLines()`                             |
| `Loader` / `CancellableLoader` | Loading spinner                | `start()`, `stop()`, `setMessage()`      |
| `Image`                        | Render images (base64)         | `getImageId()`                           |

Each component is its own file — import directly from the package, no barrel re-exports.

## Rendering Rules

Every `render(width)` line must not exceed `width` visible columns. Use `truncateToWidth()`, `wrapTextWithAnsi()`, or `visibleWidth()` to enforce this. Each rendered line gets a full SGR reset appended — styles do not carry across lines.

## Focusable Components

`Input`, `Editor` implement `Focusable`. Custom components with cursors must also implement `Focusable` and emit `CURSOR_MARKER` in render output when focused. When a container wraps an Input/Editor, propagate focus to the child for correct IME candidate window positioning.

## Keybindings & Key Detection

Use `matchesKey()` for raw detection: `matchesKey(data, Key.enter)`, `Key.ctrl("c")`, `Key.shift("tab")`. For user-customizable bindings, use the global `KeybindingsManager` via `getKeybindings()` — components like `Editor`, `Input`, `SelectList`, and `SettingsList` route input through named bindings.

## Overlays

```typescript
tui.showOverlay(component, options); // Position: absolute > percentage > anchor
handle.hide(); // Permanent
handle.setHidden(); // Temporary
```

Overlays support `nonCapturing` mode (no keyboard focus steal) and stack with z-ordering by `focusOrder`.

## Custom Components

Each custom component lives in its own file implementing `Component`. For caching, store `cachedLines` and `cachedWidth`, reset in `invalidate()`.

See references/ for complete API reference, custom component patterns, autocomplete providers, terminal image APIs, best practices, and anti-patterns.
