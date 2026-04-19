# pi-tui Best Practices

Guidelines for building robust, maintainable terminal UIs with `@mariozechner/pi-tui`. Each rule is derived from patterns in the pi-mono codebase.

## Component Architecture

### One component per file

Each custom component lives in its own file. This keeps imports explicit, avoids circular dependencies, and makes each component independently testable. The 13 built-in components follow this rule — `input.ts`, `editor.ts`, `select-list.ts`, etc.

```typescript
// my-component.ts
import type { Component } from "@mariozechner/pi-tui";

export class MyComponent implements Component {
  render(width: number): string[] {
    /* ... */
  }
  invalidate(): void {}
}
```

### Implement the full interface

Always provide `render()` and `invalidate()`. Add `handleInput()` only when the component needs keyboard interaction. Add `dispose()` only when managing external resources (intervals, event listeners, network connections).

### Use Container for composition

Extend `Container` when your component is a logical grouping of sub-components. This gives you `addChild()`, `removeChild()`, `clear()` without reimplementing child management. The built-in `BorderedLoader`, `ToolExecutionComponent`, and `FooterComponent` all extend `Container`.

```typescript
class MyView extends Container {
  constructor() {
    super();
    this.addChild(header);
    this.addChild(content);
    this.addChild(footer);
  }
}
```

### Propagate invalidation to children

When a container wraps children, its `invalidate()` must cascade. The built-in `Container.invalidate()` does this automatically — iterate children and call their `invalidate()`. For custom wrappers, ensure no child state is left stale.

```typescript
override invalidate(): void {
  super.invalidate(); // calls Container.invalidate() which cascades to all children
  this.myCache = undefined; // also clear own cache
}
```

## Rendering

### Respect the width parameter always

The `width` parameter in `render(width)` is the terminal's current column count. Every returned line must have a visible width that does not exceed this value. The TUI will crash if a line overflows — there is no automatic truncation at the rendering layer.

Use `truncateToWidth()` for single-line truncation that preserves ANSI codes:

```typescript
import { truncateToWidth } from "@mariozechner/pi-tui";

render(width: number): string[] {
  return [truncateToWidth(this.longText, width)];
}
```

Use `wrapTextWithAnsi()` for multi-line wrapping:

```typescript
import { wrapTextWithAnsi } from "@mariozechner/pi-tui";

render(width: number): string[] {
  return wrapTextWithAnsi(this.paragraph, width);
}
```

### Use visibleWidth() before combining text

When building lines from multiple segments (left label + spacer + right value), measure each segment's visible width before padding. This prevents overflow when ANSI codes or wide characters are involved.

```typescript
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

render(width: number): string[] {
  const left = theme.fg("dim", "Status: OK");
  const right = theme.fg("accent", "main");
  const padLen = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
  return [truncateToWidth(`${left}${" ".repeat(padLen)}${right}`, width)];
}
```

### Apply SGR resets per line

Each rendered line gets a full SGR reset appended by the TUI after output. Styles do not carry across lines — apply them independently on each line.

```typescript
render(width: number): string[] {
  return [
    theme.fg("error", "Error: file not found"),
    theme.fg("dim", "Check the path and try again"), // re-apply dim here
  ];
}
```

### Cache with dirty flags

For components that perform expensive computation during render, cache the result and invalidate on state changes. Use a width comparison to detect terminal resize:

```typescript
class ExpensiveComponent implements Component {
  private cachedLines?: string[];
  private cachedWidth?: number;
  private data: MyData;

  setData(d: MyData): void {
    this.data = d;
    this.cachedLines = undefined; // cache invalidation on data change
  }

  invalidate(): void {
    this.cachedLines = undefined; // cache invalidation on theme change or explicit call
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }
    const lines = this.computeExpensiveRender(this.data, width);
    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }
}
```

### Return empty arrays for hidden states

When a component should render nothing (hidden state, empty list), return `[]` not `[""]`. An empty array contributes zero lines; `[""]` contributes one blank line. The TUI's `Container.render()` concatenates children — returning `[]` effectively removes the component from layout without detaching it.

## Focus Management

### Propagate focus through containers

When a container wraps a `Focusable` child (Input, Editor), propagate the `focused` flag. This ensures the child emits `CURSOR_MARKER` for correct IME candidate window positioning.

```typescript
class FormContainer extends Container implements Focusable {
  private _focused = false;
  readonly input = new Input();

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value; // propagate to child
  }
}
```

### Use tui.setFocus() for focus transitions

When swapping components or showing dialogs, explicitly call `tui.setFocus()` to transfer focus. The TUI handles clearing the old component's `focused` flag and setting the new one.

```typescript
function showDialog(dialog: Component): void {
  root.clear();
  root.addChild(outputLog);
  root.addChild(dialog);
  tui.setFocus(dialog); // dialog now receives keyboard input
}

function dismissDialog(): void {
  root.clear();
  root.addChild(outputLog);
  root.addChild(promptInput);
  tui.setFocus(promptInput.input); // restore focus to prompt
}
```

### Use isFocusable() type guard before accessing focused

The `isFocusable()` helper checks if a component implements `Focusable` before accessing the `focused` property. Use it when working with polymorphic component references:

```typescript
import { isFocusable } from "@mariozechner/pi-tui";

if (isFocusable(component)) {
  component.focused = true;
}
```

## Key Handling

### Use matchesKey() for all key comparisons

Never compare raw escape sequences. `matchesKey()` handles Kitty protocol events, key release masks, and modifier combinations:

```typescript
import { matchesKey, Key } from "@mariozechner/pi-tui";

handleInput(data: string): void {
  if (matchesKey(data, Key.enter)) { /* ... */ }
  if (matchesKey(data, "ctrl+c")) { /* ... */ }
  if (matchesKey(data, Key.shift("tab"))) { /* ... */ }
  if (matchesKey(data, Key.alt("left"))) { /* ... */ }
  if (matchesKey(data, Key.ctrlShift("p"))) { /* ... */ }
}
```

### Filter key release events unless explicitly needed

By default the TUI filters out key release events. Set `wantsKeyRelease = true` only for components that need smooth continuous movement (games, real-time controls). Regular UI components should ignore releases:

```typescript
import { isKeyRelease } from "@mariozechner/pi-tui";

// Standard component — filter releases automatically (default)
handleInput(data: string): void {
  if (matchesKey(data, "up")) this.move(-1);
}

// Game component — needs both press and release for smooth movement
wantsKeyRelease = true;
handleInput(data: string): void {
  const pressed = !isKeyRelease(data);
  if (data === "w") this.engine.setForward(pressed);
}
```

### Route input through KeybindingsManager in extensions

Extensions should use named keybindings from `getKeybindings()` rather than hardcoded key sequences. This respects user customization:

```typescript
import { getKeybindings, matchesKey } from "@mariozechner/pi-tui";

handleInput(data: string): void {
  const kb = getKeybindings();
  if (matchesKey(data, kb.get("tui.editor.cursorLeft"))) {
    this.cursorCol--;
  }
}
```

## Overlays

### Use percentage sizing for responsive overlays

Overlay dimensions as percentages adapt to terminal resizes. Absolute numbers lock the overlay size:

```typescript
const handle = tui.showOverlay(component, {
  width: "75%", // adapts to terminal width
  maxHeight: "90%", // adapts to terminal height
  anchor: "center",
  margin: { top: 1 }, // leave space at top
});
```

### Use nonCapturing for informational overlays

Overlays that display information without requiring input (status indicators, floating tooltips) should use `nonCapturing: true` so they don't steal keyboard focus from the underlying component.

```typescript
const handle = tui.showOverlay(statusIndicator, {
  anchor: "bottom-right",
  nonCapturing: true,
});
```

### Use visible callback for dimension-aware overlays

The `visible` callback controls whether an overlay renders based on terminal dimensions. Useful for preventing overlays from appearing on terminals too small to be useful:

```typescript
const handle = tui.showOverlay(component, {
  anchor: "center",
  visible: (termWidth, termHeight) => termWidth >= 80 && termHeight >= 24,
});
```

### Hide overlays before disposing components

When dismissing an overlay, call `handle.hide()` to properly restore focus and remove the component from the overlay stack. The TUI will route focus back to the previous target.

```typescript
const handle = tui.showOverlay(dialog);

// When done:
handle.hide(); // removes from stack, restores focus to preFocus component
```

### Use ctx.ui.custom() for extension overlays

In extensions, `ctx.ui.custom()` provides the cleanest pattern for overlay-based interactions. It handles TUI lifecycle, theme access, and returns a resolved value via the `done()` callback:

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, _kb, done) => {
    const list = new SelectList(items, 8, {});
    list.onSelect = (item) => done(item.value);
    list.onCancel = () => done(null);
    return list;
  },
  {
    overlay: true,
    overlayOptions: { width: "60%", anchor: "center" },
  },
);

if (result === null) return; // user cancelled
```

## Resource Management

### Implement dispose() for all managed resources

Components that create intervals, timeouts, event listeners, or network connections must implement `dispose()` and clean up everything. This is called when the component is removed from the TUI hierarchy or when an overlay is dismissed.

```typescript
class TimerComponent implements Component {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(tui: TUI) {
    this.interval = setInterval(() => tui.requestRender(), 1000);
  }

  dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

### Use AbortSignal for cancellable async operations

The `CancellableLoader` and `BorderedLoader` expose an `AbortSignal`. Pass it to fetch calls, database queries, or any async operation that should honour user cancellation:

```typescript
const loader = new BorderedLoader(tui, theme, "Loading...");

fetch(url, { signal: loader.signal })
  .then((r) => r.json())
  .then((data) => done(data))
  .catch((err) => {
    if (err.name === "AbortError") return; // user cancelled — don't error
    done(null);
  });
```

### Return dispose functions from subscriptions

When subscribing to events or data providers, capture the unsubscribe function and call it in `dispose()`:

```typescript
class LiveStatus implements Component {
  private unsub: (() => void) | null = null;

  constructor(provider: DataProvider) {
    this.unsub = provider.onUpdate(() => tui.requestRender());
  }

  dispose(): void {
    this.unsub?.();
    this.unsub = null;
  }
}
```

## Extension Patterns

### Guard UI operations with ctx.hasUI

Extensions may run in headless modes (RPC, print mode). Always check `ctx.hasUI` before calling UI methods:

```typescript
if (!ctx.hasUI) {
  return { result: { output: "Interactive mode required", exitCode: 1 } };
}
```

### Use session_start for one-time setup

Register UI elements (headers, footers, autocomplete providers) during `session_start` rather than in the extension factory. The factory runs at load time; `session_start` fires when the TUI is available:

```typescript
pi.on("session_start", async (_event, ctx) => {
  if (ctx.hasUI) {
    ctx.ui.setHeader((tui, theme) => ({
      /* ... */
    }));
    ctx.ui.addAutocompleteProvider((current) => createProvider(current));
  }
});
```

### Delegate tool execution to originals when customizing renderers

When overriding a built-in tool's rendering, delegate `execute()` to the original tool instance rather than reimplementing logic:

```typescript
const originalRead = createReadTool(cwd);

pi.registerTool({
  name: "read",
  // ... same parameters as original
  async execute(toolCallId, params, signal, onUpdate) {
    return originalRead.execute(toolCallId, params, signal, onUpdate);
  },
  renderCall(args, theme) {
    /* custom compact rendering */
  },
  renderResult(result, meta, theme) {
    /* custom compact rendering */
  },
});
```

### Use footerData for accessible data in custom footers

The `footerData` parameter in `setFooter()` provides access to git branch, extension statuses, and change notifications. Subscribe via `onBranchChange()` for automatic re-renders:

```typescript
ctx.ui.setFooter((tui, theme, footerData) => {
  const unsub = footerData.onBranchChange(() => tui.requestRender());

  return {
    dispose: unsub,
    invalidate() {},
    render(width: number): string[] {
      const branch = footerData.getGitBranch();
      // ...
    },
  };
});
```

## Testing Components

### Test rendered output width

Verify that a component's output never exceeds the requested width:

```typescript
import { visibleWidth } from "@mariozechner/pi-tui";

for (const width of [40, 80, 120]) {
  const lines = component.render(width);
  for (const line of lines) {
    assert(visibleWidth(line) <= width, `Line exceeds width ${width}`);
  }
}
```

### Test input handling with key identifiers

Use the same `Key` helper in tests as in production code:

```typescript
component.handleInput(Key.enter);
assert(component.state === "submitted");

component.handleInput(Key.ctrl("c"));
assert(component.state === "cancelled");
```

### Test overlay lifecycle

Verify that overlays properly restore focus after dismissal:

```typescript
const handle = tui.showOverlay(dialog);
assert(tui.focusedComponent === dialog);

handle.hide();
assert(tui.focusedComponent === originalFocusedComponent);
```
