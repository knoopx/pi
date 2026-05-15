# Core API Reference

## Terminal Interface

```typescript
interface Terminal {
  start(onInput: (data: string) => void, onResize: () => void): void;
  stop(): void;
  drainInput(maxMs?: number, idleMs?: number): Promise<void>; // Drain stdin before exit
  write(data: string): void;
  get columns(): number;
  get rows(): number;
  get kittyProtocolActive(): boolean; // Kitty keyboard protocol active
  moveBy(lines: number): void; // Move cursor relative (negative = up)
  hideCursor(): void;
  showCursor(): void;
  clearLine(): void; // Clear current line
  clearFromCursor(): void; // Clear from cursor to end of screen
  clearScreen(): void; // Clear entire screen and move to (0,0)
  setTitle(title: string): void; // Set terminal window title
  setProgress(active: boolean): void; // OSC 9;4 progress indicator
}
```

Built-in implementation: `ProcessTerminal` (uses `process.stdin/stdout`). Enables raw mode, bracketed paste (`\x1b[?2004h`), and Kitty keyboard protocol with flags 1+2+4. Falls back to xterm modifyOtherKeys on terminals that don't answer the Kitty query. On Windows, uses koffi to enable `ENABLE_VIRTUAL_TERMINAL_INPUT`. Uses `StdinBuffer` to split batched input into individual sequences.

## Component Interface

All components implement this. Each returned line must not exceed `width` visible columns.

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean; // Receive Kitty key release events (default: false)
  invalidate(): void; // Clear cached render state
}
```

Styles do not carry across lines — a full SGR reset is appended to each rendered line. Use `wrapTextWithAnsi()` to preserve styles across wrapped lines.

## Focusable Interface (IME Support)

Components displaying a text cursor with IME support:

```typescript
interface Focusable {
  focused: boolean; // Set by TUI on focus change; component emits CURSOR_MARKER when true
}
```

The `CURSOR_MARKER` is the APC escape sequence `\x1b_pi:c\x07` — a zero-width sequence terminals ignore. TUI scans rendered output for it, positions the hardware cursor there, and strips the marker from output. This enables IME candidate windows to appear at the correct position for CJK input methods.

Type guard: `isFocusable(component)` returns `component is Component & Focusable`.

## Container Class

Groups child components:

```typescript
class Container implements Component {
  children: Component[];
  addChild(component: Component): void;
  removeChild(component: Component): void;
  clear(): void;
  invalidate(): void;
  render(width: number): string[];
}
```

## TUI Class

Main class managing components, rendering, and input. Extends `Container`.

```typescript
type InputListenerResult = { consume?: boolean; data?: string } | undefined;
type InputListener = (data: string) => InputListenerResult;

class TUI extends Container {
  terminal: Terminal;
  onDebug?: () => void; // Global debug callback (Shift+Ctrl+D)

  constructor(terminal: Terminal, showHardwareCursor?: boolean);

  // Lifecycle
  start(): void;
  stop(): void;
  requestRender(force?: boolean): void; // force=true resets all state for full re-render

  // Focus management
  setFocus(component: Component | null): void;
  addInputListener(listener: InputListener): () => void; // Returns cleanup function
  removeInputListener(listener: InputListener): void;

  // Overlay management
  showOverlay(component: Component, options?: OverlayOptions): OverlayHandle;
  hideOverlay(): void; // Hide topmost overlay, restore previous focus
  hasOverlay(): boolean; // Check if any visible overlay exists

  // Rendering control
  getShowHardwareCursor(): boolean;
  setShowHardwareCursor(enabled: boolean): void;
  getClearOnShrink(): boolean;
  setClearOnShrink(enabled: boolean): void; // Clear empty rows when content shrinks (default: off, PI_CLEAR_ON_SHRINK=1 enables)
  invalidate(): void;

  // Debugging
  get fullRedraws(): number; // Count of full redraws performed
}
```

### Rendering Strategies

TUI uses differential rendering to minimize terminal writes:

1. **First render** — outputs all lines without clearing scrollback (assumes clean screen)
2. **Full re-render** — triggered by width changes, content changes above the viewport, or Termux height changes. Clears screen and redraws everything
3. **Differential update** — finds first changed line, moves cursor there, renders only changed region. Only touches lines within the current viewport

All updates are wrapped in synchronized output (`\x1b[?2026h` ... `\x1b[?2026l`) for atomic flicker-free rendering. Render scheduling uses a minimum interval of 16ms to batch rapid updates.

### Cell Size Querying

On startup, TUI queries terminal cell dimensions (`CSI 16 t`) when image support is detected. Response format `CSI 6 ; height ; width t` is consumed transparently and used for accurate Image component sizing.

## Overlay Types

### OverlayAnchor

Position anchor: `"center"`, `"top-left"`, `"top-right"`, `"bottom-left"`, `"bottom-right"`, `"top-center"`, `"bottom-center"`, `"left-center"`, `"right-center"`.

### OverlayMargin

```typescript
interface OverlayMargin {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}
```

`margin` in `OverlayOptions` accepts a single number (all sides) or `OverlayMargin` object. Clamps final position to terminal bounds.

### SizeValue

Absolute columns/rows (`number`) or percentage of terminal (`"50%"`).

### OverlayOptions

```typescript
interface OverlayOptions {
  width?: SizeValue; // Columns or terminal %
  minWidth?: number; // Floor after width calculation
  maxHeight?: SizeValue; // Rows or terminal %
  anchor?: OverlayAnchor; // Default: "center"
  offsetX?: number; // Horizontal offset from anchor (positive = right)
  offsetY?: number; // Vertical offset from anchor (positive = down)
  row?: SizeValue; // Absolute row OR percentage (overrides anchor when set)
  col?: SizeValue; // Absolute column OR percentage (overrides anchor when set)
  margin?: OverlayMargin | number; // Edge margins
  visible?: (termWidth: number, termHeight: number) => boolean; // Visibility callback per frame
  nonCapturing?: boolean; // Don't steal keyboard focus when shown
}
```

Position resolution order: absolute `row`/`col` > percentage `row`/`col` > `anchor`. `minWidth` applied as floor after all width calculation. `margin` clamps final position to terminal bounds. `visible` called each render cycle with current terminal dimensions.

### OverlayHandle

Returned by `showOverlay()`:

```typescript
interface OverlayHandle {
  hide(): void; // Permanently remove (cannot show again)
  setHidden(hidden: boolean): void; // Temporarily hide/show
  isHidden(): boolean; // Check temporary hidden state
  focus(): void; // Focus and bring to visual front
  unfocus(): void; // Release focus to previous target
  isFocused(): boolean; // Check if this overlay has focus
}
```

Overlays render on top of existing content without replacing it. They are stacked — `hideOverlay()` hides the topmost overlay and restores previous focus. Higher `focusOrder` overlays appear on top visually.
