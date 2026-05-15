# pi-tui Examples

Practical examples drawn from the pi-mono source code, demonstrating idiomatic patterns for building terminal UIs with `@mariozechner/pi-tui`.

## Basic TUI Setup

Every TUI application starts with a `TUI` instance backed by a `ProcessTerminal`. Components are added as children and rendered in a continuous loop.

```typescript
import { TUI, ProcessTerminal, Container, Text } from "@mariozechner/pi-tui";

const terminal = new ProcessTerminal();
const tui = new TUI(terminal);

const root = new Container();
root.addChild(new Text("Hello, world!"));
tui.addChild(root);

tui.start(); // starts render loop
tui.stop(); // stops and drains input
```

`TUI` extends `Container`, so you can call `tui.addChild()` directly. The render loop uses differential rendering — only changed lines are written to the terminal, wrapped in synchronized output (`CSI ?2026 h/l`) for flicker-free updates.

## Custom Components

Every component implements the `Component` interface. Each file should contain one component class — no barrel re-exports.

### Minimal Component

```typescript
import type { Component } from "@mariozechner/pi-tui";

class StatusLine implements Component {
  private message = "Ready";

  setMessage(msg: string): void {
    this.message = msg;
  }

  render(width: number): string[] {
    return [` ${this.message}`.padEnd(width)];
  }

  invalidate(): void {}
}
```

### Component with State and Input Handling

The `handleInput()` method is optional but required for interactive components. The TUI only routes input to the focused component.

```typescript
import type { Component } from "@mariozechner/pi-tui";
import { matchesKey, Key } from "@mariozechner/pi-tui";

class Counter implements Component {
  private count = 0;

  handleInput(data: string): void {
    if (matchesKey(data, Key.enter)) {
      this.count++;
    } else if (matchesKey(data, "ctrl+c")) {
      // Cancel or exit
    }
  }

  render(width: number): string[] {
    return [`Count: ${this.count} (Enter to increment)`];
  }

  invalidate(): void {}
}
```

### Component with Caching

Cache rendered output and invalidate on state changes. This avoids expensive recomputation on every render cycle.

```typescript
import type { Component } from "@mariozechner/pi-tui";

class CachedList implements Component {
  private items: string[] = [];
  private cachedLines?: string[];
  private cachedWidth?: number;

  setItems(newItems: string[]): void {
    this.items = newItems;
    this.cachedLines = undefined; // clear cache
  }

  invalidate(): void {
    this.cachedLines = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }
    const lines = this.items.map((item, i) => `  ${i + 1}. ${item}`);
    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }
}
```

### Component with Disposables

Components that manage timers, intervals, or external resources should implement `dispose()`. This is called when the component is removed from the TUI.

```typescript
import type { Component } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";

class Spinner implements Component {
  private tui: TUI;
  private interval: ReturnType<typeof setInterval> | null = null;
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];
  private frameIndex = 0;

  constructor(tui: TUI) {
    this.tui = tui;
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      tui.requestRender();
    }, 80);
  }

  render(_width: number): string[] {
    return [`${this.frames[this.frameIndex]} Loading...`];
  }

  invalidate(): void {}

  dispose(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
```

## Overlays

Overlays render on top of base content with configurable positioning. They support z-ordering, non-capturing mode, and dimension-aware visibility.

### Basic Overlay

```typescript
import {
  TUI,
  ProcessTerminal,
  Container,
  Text,
  SelectList,
} from "@mariozechner/pi-tui";

const tui = new TUI(new ProcessTerminal());
tui.addChild(new Container());

const items = [
  { value: "one", label: "Option One" },
  { value: "two", label: "Option Two" },
];

const list = new SelectList(items, 5, {});
list.onSelect = (item) => {
  console.log("Selected:", item.value);
  handle.hide();
};

const handle = tui.showOverlay(list, {
  width: "60%",
  maxHeight: "50%",
  anchor: "center",
});
```

### Overlay with Percentage Positioning

Position overlays using percentage strings relative to terminal dimensions. `row` and `col` accept values like `"25%"` or absolute numbers.

```typescript
// Top-right corner, 40% wide
const handle = tui.showOverlay(component, {
  width: "40%",
  row: "0%", // top edge
  col: "60%", // start at 60% from left
});
```

### Non-Capturing Overlay

Use `nonCapturing: true` for overlays that should not steal keyboard focus (e.g., status indicators, floating tooltips).

```typescript
const handle = tui.showOverlay(statusComponent, {
  anchor: "bottom-right",
  nonCapturing: true,
});
```

### Overlay with Visibility Callback

Control visibility based on terminal dimensions using the `visible` callback. Useful for responsive overlays that should hide on small terminals.

```typescript
const handle = tui.showOverlay(component, {
  anchor: "center",
  visible: (width, height) => width >= 80 && height >= 24,
});
```

### Overlay Handle API

The returned `OverlayHandle` provides full lifecycle control:

```typescript
const handle = tui.showOverlay(component);

handle.hide(); // permanently remove (cannot be shown again)
handle.setHidden(true); // temporarily hide
handle.isHidden(); // check temporary hidden state
handle.focus(); // bring to front and capture focus
handle.unfocus(); // release focus to previous target
handle.isFocused(); // check if currently focused
```

### Overlay with ctx.ui.custom()

In extensions, use `ctx.ui.custom()` for overlays that need TUI access. The callback receives `(tui, theme, keybindings, done)` and returns a component. Call `done(result)` when the overlay should be dismissed.

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
    overlayOptions: {
      width: "75%",
      maxHeight: "95%",
      anchor: "center",
      margin: { top: 1 },
    },
  },
);
```

## Focusable Components

`Input` and `Editor` implement `Focusable`. Custom components with cursors must also set a `focused` getter/setter and emit `CURSOR_MARKER` in render output when focused.

### Using Input Component

```typescript
import { Input } from "@mariozechner/pi-tui";

const input = new Input();
input.onSubmit = (value: string) => {
  console.log("Submitted:", value);
};
input.onEscape = () => {
  console.log("Cancelled");
};

tui.addChild(input);
tui.setFocus(input); // component receives keyboard input
```

### Focus Propagation in Containers

When a `Container` wraps an `Input` or `Editor`, propagate focus to the child for correct IME candidate window positioning:

```typescript
class MyForm extends Container implements Focusable {
  private _focused = false;
  readonly input = new Input();

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value; // propagate to child
  }

  constructor() {
    super();
    this.addChild(this.input);
  }

  render(width: number): string[] {
    return [...this.input.render(width)];
  }

  handleInput(data: string): void {
    this.input.handleInput(data);
  }

  invalidate(): void {
    this.input.invalidate();
  }
}
```

### Custom Focusable with Cursor Marker

For components that display a cursor (e.g., custom editors, position indicators), emit `CURSOR_MARKER` at the cursor position:

```typescript
import {
  CURSOR_MARKER,
  type Component,
  type Focusable,
} from "@mariozechner/pi-tui";

class PositionIndicator implements Component, Focusable {
  private _focused = false;
  private pos = 0;

  get focused(): boolean {
    return this._focused;
  }
  set focused(v: boolean) {
    this._focused = v;
  }

  handleInput(data: string): void {
    if (data === "l") this.pos++;
    if (data === "h" && this.pos > 0) this.pos--;
  }

  render(width: number): string[] {
    const line =
      " ".repeat(this.pos) + (this.focused ? CURSOR_MARKER : "") + "▌";
    return [line.padEnd(width)];
  }

  invalidate(): void {}
}
```

## Key Detection

Use `matchesKey()` with the `Key` helper for Kitty protocol support. Never compare raw escape sequences manually.

### Basic Key Matching

```typescript
import { matchesKey, Key, isKeyRelease } from "@mariozechner/pi-tui";

handleInput(data: string): void {
  // Ignore key release events (unless wantsKeyRelease = true)
  if (isKeyRelease(data)) return;

  if (matchesKey(data, Key.enter)) {
    this.submit();
  } else if (matchesKey(data, "ctrl+c")) {
    this.cancel();
  } else if (matchesKey(data, Key.shift("tab"))) {
    this.prevField();
  } else if (matchesKey(data, Key.alt("left"))) {
    this.moveWordLeft();
  } else if (matchesKey(data, Key.ctrlShift("p"))) {
    this.commandPalette();
  }
}
```

### Smooth Movement with Key Release Events

For games or real-time controls, opt into key release events:

```typescript
class GameComponent implements Component {
  wantsKeyRelease = true; // receive both press and release events

  handleInput(data: string): void {
    const pressed = !isKeyRelease(data);
    if (matchesKey(data, "w")) {
      this.engine.setKey(pressed, "forward");
    }
  }
}
```

## Container Composition

Use `Container` to compose multiple components. The `Container.render()` method concatenates children's output top-to-bottom.

### Static Composition

```typescript
import { Container, Text, Spacer } from "@mariozechner/pi-tui";

const root = new Container();
root.addChild(new Text("Header"));
root.addChild(new Spacer(1));
root.addChild(contentComponent);
root.addChild(new Spacer(1));
root.addChild(new Text("Footer"));
tui.addChild(root);
```

### Dynamic Rebuilding

Clear and rebuild children when state changes:

```typescript
class StatefulView extends Container {
  private mode: "list" | "detail";

  updateMode(mode: "list" | "detail"): void {
    this.mode = mode;
    this.clear(); // removes all children
    if (mode === "list") {
      this.addChild(listComponent);
    } else {
      this.addChild(detailComponent);
    }
  }
}
```

### Box with Custom Background

`Box` wraps child components with padding and optional background coloring:

```typescript
import { Box, Text } from "@mariozechner/pi-tui";

const box = new Box(1, 0); // paddingX, paddingY
box.setBgFn((str) => `\x1b[48;2;30;30;50m${str}\x1b[0m`); // dark blue bg
box.addChild(new Text("Content"));
```

## Tool Rendering in Extensions

Custom tool rendering uses `renderCall()` and `renderResult()` to control how tools appear during execution. Return any `Component` — typically `Text`.

### Compact Tool Renderer

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "my_tool",
    label: "My Tool",
    description: "Does something useful",
    parameters: Type.Object({ query: Type.String() }),

    async execute(_toolCallId, params) {
      return {
        content: [{ type: "text", text: `Result for: ${params.query}` }],
      };
    },

    // Shown while tool args are being streamed in
    renderCall(args, theme) {
      return new Text(
        theme.fg("toolTitle", theme.bold("my_tool ")) +
          theme.fg("accent", args.query),
        0,
        0,
      );
    },

    // Shown after execution completes
    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Working..."), 0, 0);

      const text =
        result.content[0]?.type === "text" ? result.content[0].text : "";
      let output = theme.fg("success", "done");
      if (expanded) {
        output += `\n${theme.fg("dim", text.slice(0, 50))}`;
      }
      return new Text(output, 0, 0);
    },
  });
}
```

## Custom Header and Footer

Extensions can replace the built-in header and footer with custom components.

### Custom Header

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

pi.on("session_start", async (_event, ctx) => {
  if (ctx.hasUI) {
    ctx.ui.setHeader((_tui, theme) => ({
      render(_width: number): string[] {
        const block = "█";
        return [
          `  ${theme.fg("accent", block.repeat(20))}`,
          `     ${theme.bold("My Agent")}`,
          `${theme.fg("dim", "   v1.0.0")}`,
        ];
      },
      invalidate() {},
    }));
  }
});
```

### Custom Footer with Live Data

```typescript
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

ctx.ui.setFooter((tui, theme, footerData) => {
  // Subscribe to git branch changes for auto-re-render
  const unsub = footerData.onBranchChange(() => tui.requestRender());

  return {
    dispose: unsub,
    invalidate() {},
    render(width: number): string[] {
      const branch = footerData.getGitBranch();
      const left = theme.fg(
        "dim",
        `sessions: ${ctx.sessionManager.getBranch().length}`,
      );
      const right = branch ? theme.fg("dim", branch) : "";
      const pad = " ".repeat(
        Math.max(1, width - visibleWidth(left) - visibleWidth(right)),
      );
      return [truncateToWidth(left + pad + right, width)];
    },
  };
});

// Reset to default footer
ctx.ui.setFooter(undefined);
```

## Autocomplete Providers

Custom autocomplete providers intercept input and return suggestions. They chain to the previous provider using a wrapper pattern.

### GitHub Issue Autocomplete

When the user types `#`, filter and suggest issue numbers:

```typescript
import type {
  AutocompleteProvider,
  AutocompleteItem,
} from "@mariozechner/pi-tui";

function createIssueProvider(
  current: AutocompleteProvider,
  issues: GitHubIssue[],
): AutocompleteProvider {
  return {
    async getSuggestions(lines, cursorLine, cursorCol, options) {
      const line = lines[cursorLine] ?? "";
      const beforeCursor = line.slice(0, cursorCol);

      // Only trigger on # prefix at word boundary
      const match = beforeCursor.match(/(?:^|[ \t])#(\d*)$/);
      if (!match)
        return current.getSuggestions(lines, cursorLine, cursorCol, options);

      const query = match[1];
      const filtered = query
        ? issues.filter((i) => String(i.number).startsWith(query))
        : issues;

      if (filtered.length === 0)
        return current.getSuggestions(lines, cursorLine, cursorCol, options);

      return {
        items: filtered.map((i) => ({
          value: `#${i.number}`,
          label: `#${i.number}`,
          description: `[${i.state}] ${i.title}`,
        })),
        prefix: `#${query}`,
      };
    },

    applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
      return current.applyCompletion(
        lines,
        cursorLine,
        cursorCol,
        item,
        prefix,
      );
    },

    shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
      return (
        current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ??
        true
      );
    },
  };
}

// Register via extension API
ctx.ui.addAutocompleteProvider((current) =>
  createIssueProvider(current, issues),
);
```

## BorderedLoader for Async Operations

The `BorderedLoader` (from pi-coding-agent) wraps a cancellable loader with borders. Use it for any async operation that might take time.

```typescript
import { BorderedLoader } from "@mariozechner/pi-coding-agent";

const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
  const loader = new BorderedLoader(tui, theme, "Processing...");
  loader.onAbort = () => done(null);

  // Use loader.signal for AbortSignal-compatible cancellation
  doAsyncWork(loader.signal)
    .then(done)
    .catch(() => done(null));

  return loader;
});

if (result === null) {
  ctx.ui.notify("Cancelled", "info");
  return;
}
```

## Interactive Shell Suspension

Suspend the TUI to run a full-screen interactive command, then restore:

```typescript
import { spawnSync } from "node:child_process";

const exitCode = await ctx.ui.custom<number>((tui, _theme, _kb, done) => {
  tui.stop(); // Release terminal to shell
  process.stdout.write("\x1b[2J\x1b[H"); // Clear screen

  const result = spawnSync(process.env.SHELL || "sh", ["-c", command], {
    stdio: "inherit",
  });

  tui.start(); // Restore TUI
  tui.requestRender(true); // Full re-render
  done(result.status ?? 1);

  // Return empty component — immediately disposed since done() was called
  return { render: () => [], invalidate: () => {} };
});
```

## Width-Safe Rendering

Every `render(width)` line must not exceed `width` visible columns. Use the utility functions from pi-tui to enforce this.

### Always Truncate Output

```typescript
import { truncateToWidth, wrapTextWithAnsi, visibleWidth } from "@mariozechner/pi-tui";

render(width: number): string[] {
  // Single-line truncation (preserves ANSI codes)
  return [truncateToWidth("This is a very long line of text", width)];
}
```

### Multi-Line Text Wrapping

```typescript
render(width: number): string[] {
  const wrapped = wrapTextWithAnsi(longText, width);
  return wrapped;
}
```

### Measuring Width Before Combining

```typescript
import { visibleWidth } from "@mariozechner/pi-tui";

render(width: number): string[] {
  const left = "Status: OK";
  const right = "Branch: main";
  const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
  return [`${left}${pad}${right}`];
}
```

## Real-Time Rendering

For high-frequency updates (games, live data feeds), use `requestRender()` with an interval. The TUI throttles renders to ~60fps via `MIN_RENDER_INTERVAL_MS`.

### Game Loop Pattern

```typescript
class GameOverlay implements Component {
  private tui: TUI;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(tui: TUI) {
    this.tui = tui;
    this.interval = setInterval(() => {
      this.tick();
      tui.requestRender(); // Throttled internally to ~60fps
    }, 1000 / 35); // Target 35 FPS game logic
  }

  render(width: number): string[] {
    const height = Math.max(10, Math.floor(width / 3.2)); // Aspect ratio aware
    return this.engine.renderFrame(width, height);
  }

  invalidate(): void {}

  dispose(): void {
    if (this.interval) clearInterval(this.interval);
  }
}
```

## Output Log Component

A scrollable text buffer that accumulates lines and renders only the visible tail. Pattern used in RPC chat clients.

```typescript
class OutputLog implements Component {
  private lines: string[] = [];
  private maxLines = 1000;
  private visibleLines = 0;

  setVisibleLines(n: number): void {
    this.visibleLines = n;
  }

  append(line: string): void {
    this.lines.push(line);
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    if (this.lines.length === 0) return [""];
    const n = this.visibleLines > 0 ? this.visibleLines : this.lines.length;
    return this.lines.slice(-n).map((l) => l.slice(0, width));
  }
}
```

## Dialog Pattern with Component Swapping

Replace the bottom input area with a dialog component, then restore:

```typescript
class DialogManager {
  private root: Container;
  private outputLog: OutputLog;
  private promptInput: Input;
  private activeDialog: Component | null = null;

  constructor(root: Container, outputLog: OutputLog, promptInput: Input) {
    this.root = root;
    this.outputLog = outputLog;
    this.promptInput = promptInput;
  }

  showDialog(dialog: Component): void {
    this.activeDialog = dialog;
    this.rebuild();
  }

  dismissDialog(): void {
    this.activeDialog = null;
    this.rebuild();
  }

  private rebuild(): void {
    this.root.clear();
    this.root.addChild(this.outputLog);
    this.root.addChild(this.activeDialog ?? this.promptInput);
  }
}
```

## Keybinding Integration

Components in extensions should use the global `KeybindingsManager` via `getKeybindings()` rather than raw `matchesKey()`. This allows users to customize keys.

```typescript
import { getKeybindings, matchesKey } from "@mariozechner/pi-tui";

handleInput(data: string): void {
  const kb = getKeybindings();

  if (matchesKey(data, kb.get("tui.editor.cursorUp"))) {
    this.moveCursor(-1);
  } else if (matchesKey(data, kb.get("tui.editor.cursorDown"))) {
    this.moveCursor(1);
  }
}
```

## Common Anti-Patterns to Avoid

### Never hardcode line widths

```typescript
// BAD — breaks on different terminal sizes
render(width: number): string[] {
  return ["This line is exactly 80 characters wide and will crash on narrow terminals"];
}

// GOOD — always respect the width parameter
render(width: number): string[] {
  return [truncateToWidth("This line respects the terminal width", width)];
}
```

### Never let styles bleed across lines

Each rendered line gets a full SGR reset appended automatically. Do not assume styles carry over:

```typescript
// BAD — second line won't be red
render(width: number): string[] {
  return [
    "\x1b[31mRed text",
    "Still red? No, it's not.", // SGR reset was applied after line 1
  ];
}

// GOOD — apply styles per line
render(width: number): string[] {
  return [
    "\x1b[31mRed text",
    "\x1b[31mStill red",
  ];
}
```

### Don't skip invalidation

When a component caches output, `invalidate()` must clear the cache. Otherwise theme changes or external updates won't trigger re-renders:

```typescript
// BAD — cache never clears on theme change
class BadComponent implements Component {
  private cachedLines?: string[];
  invalidate(): void {} // no-op but cache exists!
}

// GOOD — cache cleared in invalidate()
class GoodComponent implements Component {
  private cachedLines?: string[];
  invalidate(): void {
    this.cachedLines = undefined;
  }
}
```

### Don't forget dispose() for resources

Components with intervals, timeouts, or event listeners must clean up:

```typescript
// BAD — interval leaks when component is removed
class BadSpinner implements Component {
  constructor(tui: TUI) {
    setInterval(() => tui.requestRender(), 100); // never cleared
  }
}

// GOOD — dispose() cleans up
class GoodSpinner implements Component {
  private interval: ReturnType<typeof setInterval> | null = null;
  constructor(tui: TUI) {
    this.interval = setInterval(() => tui.requestRender(), 100);
  }
  dispose(): void {
    if (this.interval) clearInterval(this.interval);
  }
}
```
