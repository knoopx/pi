# pi-tui Anti-Patterns

Common mistakes when building terminal UIs with `@mariozechner/pi-tui`. Each pattern shows the failure, explains why it breaks, and provides the correct approach. All examples are derived from real issues in the pi-mono codebase.

## Rendering Failures

### Lines exceeding terminal width

The most common cause of TUI crashes. When a rendered line's visible width exceeds the `width` parameter, the TUI throws and writes a crash log.

```typescript
// FAILS — hardcoded string exceeds narrow terminals
render(width: number): string[] {
  return ["This is a very long status message that will definitely overflow on smaller screens"];
}

// WORKS — truncate to fit
render(width: number): string[] {
  const text = "This is a very long status message that will definitely overflow on smaller screens";
  return [truncateToWidth(text, width)];
}
```

The TUI has a hard guard in `doRender()` that checks `visibleWidth(line) > width` and throws with debug output. There is no recovery — the process crashes to prevent terminal corruption.

### Using string length instead of visible width

String `.length` counts code points, not terminal columns. Wide characters (CJK, emoji) occupy 2 columns. ANSI escape sequences are invisible but count toward `.length`.

```typescript
// FAILS — "✓" is 1 char but 2 columns; "\x1b[31m" adds invisible chars
const text = "\x1b[31m✓ Done\x1b[0m";
text.length; // 15 (includes escape sequences)
visibleWidth(text); // 6 (actual terminal columns: 2 for ✓ + 4 for " Done")

// FAILS — truncating by char length cuts mid-escape-sequence
render(width: number): string[] {
  return [text.slice(0, width)]; // may leave dangling ANSI codes
}

// WORKS — truncates respecting ANSI boundaries and wide chars
render(width: number): string[] {
  return [truncateToWidth(text, width)];
}
```

### Concatenating segments without measuring

When building lines from left pad + content + right align, assuming character counts match visual widths causes overflow:

```typescript
// FAILS — visibleWidth("←") is 2, so total is 16 not 15
render(width: number): string[] {
  const left = "Status";
  const right = "← Back";
  const pad = width - left.length - right.length; // wrong: uses .length
  return [`${left}${" ".repeat(pad)}${right}`]; // may exceed width
}

// WORKS — measures actual visible widths
render(width: number): string[] {
  const left = "Status";
  const right = "← Back";
  const pad = Math.max(1, width - visibleWidth(left) - visibleWidth(right));
  return [truncateToWidth(`${left}${" ".repeat(pad)}${right}`, width)];
}
```

### Letting ANSI styles bleed across lines

Each line gets an SGR reset appended automatically. Styles from one line do not carry to the next — but many developers write code assuming they do, then wonder why colors look wrong.

```typescript
// FAILS — second line won't be red (SGR reset after first line)
render(width: number): string[] {
  return [
    "\x1b[31mError",
    "Something went wrong", // renders in default color, not red
  ];
}

// WORKS — applies style per line
render(width: number): string[] {
  return [
    "\x1b[31mError",
    "\x1b[31mSomething went wrong",
  ];
}
```

### Returning inconsistent line counts

Components that return different numbers of lines on each render cause the differential renderer to work harder than necessary. This isn't a crash, but it creates visible jitter when content height shifts during animations or state transitions.

```typescript
// JITTERS — height changes from 3 lines to 1 line
render(width: number): string[] {
  if (this.loading) {
    return ["Loading...", "", "...please wait"]; // 3 lines
  }
  return ["Ready"]; // 1 line — causes viewport shift
}

// SMOOTH — consistent height
render(width: number): string[] {
  if (this.loading) {
    return ["Loading...", "", "...please wait"];
  }
  return ["Ready", "", ""]; // same height
}
```

## State Management

### Stale cached renders after invalidation

Components that cache rendered output must clear the cache in `invalidate()`. If they don't, theme changes, data updates, or terminal resizes leave the component showing stale content.

```typescript
// FAILS — invalidate() is a no-op but cache persists
class BadComponent implements Component {
  private cachedLines?: string[];

  invalidate(): void {} // no-op!

  render(width: number): string[] {
    if (this.cachedLines) return this.cachedLines; // returns stale data
    this.cachedLines = this.compute();
    return this.cachedLines;
  }
}

// WORKS — cache cleared in invalidate()
class GoodComponent implements Component {
  private cachedLines?: string[];

  invalidate(): void {
    this.cachedLines = undefined;
  }

  render(width: number): string[] {
    if (this.cachedLines) return this.cachedLines;
    this.cachedLines = this.compute();
    return this.cachedLines;
  }
}
```

### Cache width mismatch on terminal resize

When caching rendered output, always track the width used. Terminal resizes change wrapping and alignment — cached output from a different width is wrong.

```typescript
// FAILS — returns cache even after terminal resize
render(width: number): string[] {
  if (this.cachedLines) return this.cachedLines; // wrong width!
  this.cachedLines = this.compute(width);
  return this.cachedLines;
}

// WORKS — invalidates cache on width change
render(width: number): string[] {
  if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
  this.cachedLines = this.compute(width);
  this.cachedWidth = width;
  return this.cachedLines;
}
```

### Mutating shared state without re-render notification

Updating component state without calling `tui.requestRender()` leaves the display out of sync. The TUI only redraws when explicitly told to.

```typescript
// FAILS — state changes but screen doesn't update
class SilentUpdater implements Component {
  private count = 0;

  increment(): void {
    this.count++;
    // forgot tui.requestRender() — user never sees the change
  }

  render(width: number): string[] {
    return [`Count: ${this.count}`];
  }
}

// WORKS — notifies TUI of state change
increment(): void {
  this.count++;
  this.tui.requestRender(); // triggers differential re-render
}
```

## Focus Bugs

### Forgetting to propagate focus in containers

When a container wraps an `Input` or `Editor`, the child won't emit `CURSOR_MARKER` unless its `focused` flag is set. Without the marker, IME candidate windows appear at the wrong position.

```typescript
// FAILS — input.focused is never set, IME cursor mispositioned
class BrokenForm extends Container {
  readonly input = new Input();

  constructor() {
    super();
    this.addChild(this.input);
  }

  // missing: focused getter/setter that propagates to input
}

// WORKS — propagates focus flag through the container
class WorkingForm extends Container implements Focusable {
  private _focused = false;
  readonly input = new Input();

  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.input.focused = value; // cursor marker emitted correctly
  }
}
```

### Not calling tui.setFocus() after component swap

Swapping children in a container doesn't automatically transfer focus. The old component retains `focused = true`, the new one gets `focused = false`. Input goes to the wrong component.

```typescript
// FAILS — focus stays on removed component
updateView(): void {
  root.clear();
  root.addChild(newView);
  // forgot tui.setFocus(newView) — input still goes to old component
}

// WORKS — explicitly transfers focus
updateView(): void {
  root.clear();
  root.addChild(newView);
  tui.setFocus(newView); // newView now receives keyboard input
}
```

### Accessing focused without type guard

The `focused` property only exists on components implementing `Focusable`. Accessing it on a plain `Component` causes runtime errors.

```typescript
// FAILS — component may not implement Focusable
function clearFocus(component: Component): void {
  component.focused = false; // TypeError if component isn't Focusable
}

// WORKS — type guard ensures safety
function clearFocus(component: Component): void {
  if (isFocusable(component)) {
    component.focused = false;
  }
}
```

## Key Handling Mistakes

### Comparing raw escape sequences

Terminal input arrives as raw bytes. Comparing them with string literals breaks across terminals that use different protocols (Kitty, bracketed paste, etc.).

```typescript
// FAILS — assumes specific escape sequence format
handleInput(data: string): void {
  if (data === "\x1bOA") { // up arrow — only works in some terminals
    this.moveUp();
  }
}

// WORKS — matchesKey() handles all terminal protocols
handleInput(data: string): void {
  if (matchesKey(data, "up")) {
    this.moveUp();
  }
}
```

### Not filtering key release events

When `wantsKeyRelease` is not set, the TUI filters releases automatically. But if a component doesn't check for releases in its own handler, it may process them as regular input on terminals that send them.

```typescript
// FAILS — processes release event as another action trigger
handleInput(data: string): void {
  if (matchesKey(data, "w")) {
    this.moveForward(); // fires on both press AND release
  }
}

// WORKS — ignores releases (default behavior without wantsKeyRelease)
// OR explicitly filters them:
handleInput(data: string): void {
  if (isKeyRelease(data)) return;
  if (matchesKey(data, "w")) {
    this.moveForward();
  }
}
```

### Using matchesKey for non-key events

`matchesKey()` expects Kitty protocol key events. Bracketed paste data, raw text input, and other terminal events will not match correctly.

```typescript
// FAILS — paste data won't match as a key event
handleInput(data: string): void {
  if (matchesKey(data, "ctrl+v")) {
    // this only fires for the Ctrl+V key press
    // actual pasted text arrives as raw characters, not a key event
  }
}

// WORKS — Editor handles bracketed paste internally
// For custom components, use the terminal's paste handling or
// process raw character input separately from key events
```

## Overlay Mistakes

### Keeping overlay references after hiding

After calling `handle.hide()`, the overlay is removed from the stack. Holding a reference and trying to interact with it causes undefined behavior.

```typescript
// FAILS — using handle after hide()
const handle = tui.showOverlay(dialog);
handle.hide();
handle.setHidden(false); // no-op or error — overlay is gone

// WORKS — nullify reference after hiding
const handle = tui.showOverlay(dialog);
handle.hide();
// don't use handle again
```

### Blocking the render loop in overlay callbacks

The `visible` callback and overlay layout resolution run on every render cycle. Expensive computation here throttles the entire TUI.

```typescript
// FAILS — heavy computation on every render frame
const handle = tui.showOverlay(component, {
  visible: (w, h) => {
    return computeComplexLayout(w, h); // called ~60 times/second
  },
});

// WORKS — cache the result or use simple checks
let lastDimensions = { w: 0, h: 0 };
const handle = tui.showOverlay(component, {
  visible: (w, h) => w >= 80 && h >= 24, // fast comparison
});
```

### Showing capturing overlays on top of focused components

When multiple capturing overlays stack, only the topmost receives input. Showing a second capturing overlay while the first is active creates confusion — the user interacts with one but sees both.

```typescript
// FAILS — two capturing overlays compete for focus
const handle1 = tui.showOverlay(dialog1); // captures focus
const handle2 = tui.showOverlay(dialog2); // steals focus from dialog1
// User can only interact with dialog2, but both are visible

// WORKS — hide first before showing second, or use nonCapturing
handle1.hide();
const handle2 = tui.showOverlay(dialog2);
```

## Resource Leaks

### Intervals surviving component removal

Components that start intervals but don't implement `dispose()` leak timers. These continue firing after the component is removed, calling methods on garbage-collected objects.

```typescript
// FAILS — interval continues after component is removed
class LeakySpinner implements Component {
  constructor(tui: TUI) {
    setInterval(() => {
      this.frame++;
      tui.requestRender(); // fires even after component is gone
    }, 100);
  }
  // no dispose() — interval never cleared
}

// WORKS — dispose() clears all timers
class CleanSpinner implements Component {
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(tui: TUI) {
    this.interval = setInterval(() => {
      this.frame++;
      tui.requestRender();
    }, 100);
  }

  dispose(): void {
    if (this.interval) clearInterval(this.interval);
  }
}
```

### Event listener accumulation

Adding listeners without removing them causes memory leaks and duplicate firing. Each re-render or state change that adds a listener without removing the old one compounds the problem.

```typescript
// FAILS — adds new listener each time without removing old one
setupDataSubscription(): void {
  this.provider.onUpdate(() => {
    this.data = newData;
    tui.requestRender();
  });
  // previous listener still fires — double, triple, quadruple updates
}

// WORKS — captures and calls unsubscribe function
private unsub: (() => void) | null = null;

setupDataSubscription(): void {
  this.unsub?.(); // remove previous listener
  this.unsub = this.provider.onUpdate(() => {
    this.data = newData;
    tui.requestRender();
  });
}

dispose(): void {
  this.unsub?.();
}
```

### Not cleaning up custom headers/footers

Custom headers and footers hold references to TUI instances and theme objects. Not clearing them when switching sessions or disposing extensions keeps stale render functions alive.

```typescript
// FAILS — old footer callback holds reference to old ctx
pi.on("session_start", async (_event, ctx) => {
  ctx.ui.setFooter((tui, theme, footerData) => {
    // uses ctx from closure — stale after session switch
    return { render: () => [ctx.model?.id || ""] };
  });
});

// WORKS — captures needed data or clears on session end
pi.on("session_start", async (_event, ctx) => {
  const modelId = ctx.model?.id; // snapshot at setup time
  ctx.ui.setFooter((tui, theme, footerData) => {
    return { render: () => [modelId || ""] };
  });
});
```

## Extension Anti-Patterns

### Calling UI methods without hasUI check

Extensions may run in headless modes. Calling `ctx.ui.select()` or `ctx.ui.custom()` without checking `ctx.hasUI` throws runtime errors.

```typescript
// FAILS — crashes in RPC mode or print mode
pi.registerCommand("my-command", {
  handler: async (_args, ctx) => {
    const choice = await ctx.ui.select("Choose", ["A", "B"]); // throws if no UI
  },
});

// WORKS — guards with hasUI check
pi.registerCommand("my-command", {
  handler: async (_args, ctx) => {
    if (!ctx.hasUI) {
      ctx.ui.notify("Requires interactive mode", "error");
      return;
    }
    const choice = await ctx.ui.select("Choose", ["A", "B"]);
  },
});
```

### Setting UI elements in extension factory

The extension factory runs at module load time, before the TUI is initialized. UI setup must happen during `session_start` when the TUI is available.

```typescript
// FAILS — TUI not ready at factory execution time
export default function (pi: ExtensionAPI) {
  ctx.ui.setHeader(...); // ctx doesn't exist here yet
}

// WORKS — waits for session_start event
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.setHeader((tui, theme) => ({ /* ... */ }));
    }
  });
}
```

### Blocking the event handler with synchronous work

Extension event handlers run in the main event loop. Synchronous blocking (heavy computation, synchronous file reads) freezes the entire TUI.

```typescript
// FAILS — blocks render loop during large file read
pi.on("user_input", async (_event, ctx) => {
  const content = fs.readFileSync("large-file.txt", "utf-8"); // blocks
  // TUI can't render, can't process input while this runs
});

// WORKS — uses async file operations
pi.on("user_input", async (_event, ctx) => {
  const content = await fs.promises.readFile("large-file.txt", "utf-8");
});
```

### Registering duplicate tools

Calling `pi.registerTool()` with the same name multiple times creates undefined behavior. The second registration may silently override or cause conflicts.

```typescript
// FAILS — registers same tool multiple times
pi.on("session_start", (_event, ctx) => {
  pi.registerTool({ name: "my_tool" /* ... */ });
});
// session_start fires on every session — tool registered N times

// WORKS — tracks registration state
const registered = new Set<string>();

function registerOnce(name: string): boolean {
  if (registered.has(name)) return false;
  registered.add(name);
  return true;
}

pi.on("session_start", (_event, ctx) => {
  if (registerOnce("my_tool")) {
    pi.registerTool({ name: "my_tool" /* ... */ });
  }
});
```

## Architecture Anti-Patterns

### Creating components in render()

Instantiating new objects during render defeats caching and creates garbage collection pressure. Components should be created once and reused.

```typescript
// FAILS — allocates new Text component every render frame (~60fps)
render(width: number): string[] {
  const text = new Text(this.message); // allocated, rendered, discarded
  return text.render(width);
}

// WORKS — component created once, reused
private textComponent: Text;

constructor() {
  this.textComponent = new Text();
}

render(width: number): string[] {
  this.textComponent.setText(this.message);
  return this.textComponent.render(width);
}
```

### Deeply nested component trees

Excessive nesting increases render traversal cost and makes focus management harder. Flatten where possible — a single component doing its own layout is faster than ten nested Containers.

```typescript
// FAILS — unnecessary nesting depth
const root = new Container();
const wrapper1 = new Container();
const wrapper2 = new Container();
const spacer = new Spacer(1);
wrapper2.addChild(spacer);
wrapper1.addChild(wrapper2);
root.addChild(wrapper1);

// WORKS — flat structure
const root = new Container();
root.addChild(new Text("content"));
root.addChild(new Spacer(1));
```

### Using Container for conditional rendering instead of returning empty arrays

Clearing and rebuilding container children on every render is wasteful. Return `[]` from hidden components or use a dirty flag instead of structural changes.

```typescript
// FAILS — clears and rebuilds on every render
render(width: number): string[] {
  this.clear();
  if (this.showPanel) {
    this.addChild(panel);
  }
  this.addChild(alwaysVisible);
  return super.render(width);
}

// WORKS — panel returns [] when hidden
class ToggleablePanel implements Component {
  render(width: number): string[] {
    if (!this.visible) return []; // no structural change needed
    return this.computeContent(width);
  }
}
```

### Ignoring the signal parameter in async operations

When `ctx.ui.custom()` or loaders provide an `AbortSignal`, ignoring it means user cancellation has no effect. The operation continues running, consuming resources and preventing the UI from responding.

```typescript
// FAILS — fetch continues after user cancels
const result = await ctx.ui.custom((tui, theme, _kb, done) => {
  const loader = new BorderedLoader(tui, theme, "Loading...");
  // loader.signal exists but is not used

  fetch(url)
    .then((r) => r.json())
    .then((data) => done(data));
  // user presses Escape — loader.onAbort fires but fetch keeps running
  return loader;
});

// WORKS — passes signal to honor cancellation
const result = await ctx.ui.custom((tui, theme, _kb, done) => {
  const loader = new BorderedLoader(tui, theme, "Loading...");

  fetch(url, { signal: loader.signal })
    .then((r) => r.json())
    .then((data) => done(data))
    .catch((err) => {
      if (err.name !== "AbortError") done(null);
    });

  return loader;
});
```
