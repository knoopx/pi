# Custom Component Patterns

Custom components used throughout pi-coding-agent and its extensions. These demonstrate idiomatic patterns for building reusable TUI components.

## DynamicBorder

Viewport-aware horizontal border that adjusts to terminal width.

```typescript
class DynamicBorder implements Component {
  constructor(color?: (str: string) => string);
  render(width: number): string[];
  invalidate(): void;
}
```

Renders a single line of `─` characters colored with the provided function. Default color uses `theme.fg("border", str)`.

**Note:** When used from extensions loaded via jiti, the global `theme` may be undefined because jiti creates a separate module cache. Always pass an explicit color function when using `DynamicBorder` in extension components.

## BorderedLoader

A `Container` wrapping either `CancellableLoader` or `Loader` with border decorations. Exposes `AbortSignal` for async cancellation.

```typescript
class BorderedLoader extends Container {
  constructor(
    tui: TUI,
    theme: Theme,
    message: string,
    options?: { cancellable?: boolean }, // default: true
  );

  signal: AbortSignal; // Use for async operation cancellation
  onAbort: (() => void) | undefined; // Called when user presses Escape

  handleInput(data: string): void;
  dispose(): void;
}
```

Structure: `DynamicBorder` → `Loader` or `CancellableLoader` → optional cancel hint → `Spacer` → `DynamicBorder`. When `cancellable: false`, wraps a plain `Loader` with a manually managed `AbortController`.

## CustomEditor

Extends `Editor` with app-level keybinding handling for pi-coding-agent. Routes input through an `KeybindingsManager` before falling through to editor defaults.

```typescript
class CustomEditor extends Editor {
  actionHandlers: Map<AppKeybinding, () => void>;

  onEscape?: () => void; // Dynamic escape handler
  onCtrlD?: () => void; // Dynamic exit handler
  onPasteImage?: () => void; // Clipboard image paste
  onExtensionShortcut?: (data: string) => boolean; // Extension-registered shortcuts

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    options?: EditorOptions,
  );

  onAction(action: AppKeybinding, handler: () => void): void;
  handleInput(data: string): void;
}
```

Input priority: extension shortcuts → clipboard paste → app.interrupt (Escape) → app.exit (Ctrl+D) → registered action handlers → parent Editor handling. Escape is only consumed when autocomplete is NOT active (otherwise falls through to `Editor` for autocomplete cancellation). Ctrl+D only fires when editor is empty.

## FooterComponent

Renders the status footer with pwd, git branch, token usage, context window, model info, and extension statuses.

```typescript
class FooterComponent implements Component {
  constructor(session: AgentSession, footerData: ReadonlyFooterDataProvider);

  setSession(session: AgentSession): void;
  setAutoCompactEnabled(enabled: boolean): void;
  invalidate(): void; // No-op — git branch cached by provider
  dispose(): void; // No-op — cleanup handled by provider
  render(width: number): string[];
}
```

Renders up to three lines: pwd (with git branch and session name), token stats + context % + model info, extension statuses. Context % is colorized red (>90%) or yellow (>70%). Home directory replaced with `~`. Stats line right-aligns the model name; truncates left side if needed.

## ToolExecutionComponent

Renders tool call arguments and results with background coloring for pending/error/success states. Supports custom renderers, image display, and auto-conversion for Kitty protocol.

```typescript
interface ToolExecutionOptions {
  showImages?: boolean;       // default: true
  imageWidthCells?: number;   // default: 60
}

class ToolExecutionComponent extends Container {
  constructor(
    toolName: string,
    toolCallId: string,
    args: any,
    options?: ToolExecutionOptions,
    toolDefinition?: ToolDefinition<any, any>,
    ui: TUI,
    cwd: string,
  );

  updateArgs(args: any): void;
  markExecutionStarted(): void;
  setArgsComplete(): void;
  updateResult(result: { content: Array<...>; isError: boolean; details?: any }, isPartial?: boolean): void;
  setExpanded(expanded: boolean): void;
  setShowImages(show: boolean): void;
  setImageWidthCells(width: number): void;
}
```

Background transitions: `toolPendingBg` (partial) → `toolErrorBg` (error) or `toolSuccessBg` (complete). Uses tool definition's `renderCall` and `renderResult` functions when available, falling back to generic text rendering. Non-PNG images are converted to PNG for Kitty protocol compatibility via `convertToPng()`.

## Component Composition Patterns

### Container with dynamic children

Clear and rebuild children on state changes:

```typescript
class MyComponent extends Container {
  private innerBox: Box;

  constructor() {
    super();
    this.innerBox = new Box(1, 1);
    this.addChild(this.innerBox);
  }

  updateDisplay(): void {
    this.innerBox.clear();
    this.innerBox.addChild(new Text("new content"));
  }
}
```

### Conditional rendering

Use `Container` to swap child components:

```typescript
class StatefulComponent extends Container {
  private viewA: Component;
  private viewB: Component;
  private state: "a" | "b";

  render(width: number): string[] {
    this.clear();
    this.addChild(this.state === "a" ? this.viewA : this.viewB);
    return super.render(width);
  }
}
```

### Overlay composition

Use `showOverlay()` for modal dialogs, selectors, and temporary UI:

```typescript
const handle = tui.showOverlay(selectList, {
  width: "80%",
  maxHeight: "50%",
  anchor: "center",
});
handle.hide(); // Remove when done
```

### Caching pattern

Cache rendered output to avoid recomputation:

```typescript
class CachedComponent implements Component {
  private cachedLines?: string[];
  private cachedWidth?: number;
  private dirty = false;

  invalidate(): void {
    this.cachedLines = undefined;
    this.dirty = true;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width && !this.dirty) {
      return this.cachedLines;
    }
    // ... compute lines ...
    this.cachedLines = lines;
    this.cachedWidth = width;
    this.dirty = false;
    return lines;
  }
}
```

### Width-aware truncation

Always measure and truncate output to fit:

```typescript
render(width: number): string[] {
  const text = "Some long text that might overflow";
  return [truncateToWidth(text, width)];
}
```

Never trust hardcoded widths — always use the `width` parameter passed to `render()`.
