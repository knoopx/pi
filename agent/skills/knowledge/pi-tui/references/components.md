# Component Reference

All built-in components are imported from `"@mariozechner/pi-tui"` directly — no barrel re-exports. Each component lives in its own file under `dist/components/`.

---

## Container

Groups child components. Renders children top-to-bottom.

```typescript
class Container implements Component {
  children: Component[];
  constructor();
  addChild(component: Component): void;
  removeChild(component: Component): void;
  clear(): void;
  invalidate(): void;
  render(width: number): string[];
}
```

---

## Box

Container that applies padding and background color to all children.

```typescript
class Box implements Component {
  children: Component[];
  constructor(
    paddingX?: number,
    paddingY?: number,
    bgFn?: (text: string) => string,
  ); // defaults: 1, 1
  addChild(component: Component): void;
  removeChild(component: Component): void;
  clear(): void;
  setBgFn(bgFn?: (text: string) => string): void; // Update background dynamically
  invalidate(): void;
  render(width: number): string[];
}
```

---

## Text

Multi-line text with word wrapping and padding.

```typescript
class Text implements Component {
  constructor(
    text?: string,
    paddingX?: number,
    paddingY?: number,
    customBgFn?: (text: string) => string,
  ); // defaults: "", 1, 1
  setText(text: string): void;
  setCustomBgFn(customBgFn?: (text: string) => string): void;
  invalidate(): void;
  render(width: number): string[];
}
```

Caches rendered output. `customBgFn` applies background color to each line, padded to full width.

---

## TruncatedText

Single-line text that truncates to fit viewport width. For status lines and headers only — no reflow.

```typescript
class TruncatedText implements Component {
  constructor(text: string, paddingX?: number, paddingY?: number); // defaults: 0, 0
  invalidate(): void;
  render(width: number): string[];
}
```

---

## Input

Single-line text input with horizontal scrolling, undo stack, kill ring, bracketed paste mode, and Kitty CSI-u printable decoding.

```typescript
class Input implements Component, Focusable {
  focused: boolean; // Set by TUI when focus changes
  onSubmit?: (value: string) => void;
  onEscape?: () => void;

  constructor();
  getValue(): string;
  setValue(value: string): void;
  handleInput(data: string): void;
  invalidate(): void;
  render(width: number): string[];
}
```

**Key bindings:** Enter submits, Escape calls `onEscape`, Ctrl+A/E line start/end, Ctrl+W/Alt+Backspace delete word backwards, Ctrl+U delete to start, Ctrl+K delete to end, Ctrl+Left/Right word navigation, Alt+Left/Right word navigation, arrow keys and backspace/delete work normally. Supports yank (Ctrl+Y) and yank-pop (Alt+Y), undo (Ctrl+-).

**Features:** Bracketed paste mode (`\x1b[200~` / `\x1b[201~`) buffers multi-chunk pastes atomically. Kitty CSI-u printable decoding for terminals with disambiguate flag. Undo coalescing groups consecutive word characters into single undo units. Kill ring accumulates consecutive deletions.

---

## Editor

Multi-line text editor with autocomplete, file completion, paste handling, vertical scrolling when content exceeds terminal height.

```typescript
class Editor implements Component, Focusable {
  focused: boolean; // Set by TUI when focus changes
  borderColor: (str: string) => string;
  onSubmit?: (text: string) => void;
  onChange?: (text: string) => void;
  disableSubmit: boolean;

  constructor(tui: TUI, theme: EditorTheme, options?: EditorOptions);

  // Text operations
  getText(): string;
  getExpandedText(): string; // Text with paste markers expanded to actual content
  getLines(): string[];
  getCursor(): { line: number; col: number };
  setText(text: string): void;
  insertTextAtCursor(text: string): void; // Atomic for undo

  // Configuration
  getPaddingX(): number;
  setPaddingX(padding: number): void;
  getAutocompleteMaxVisible(): number;
  setAutocompleteMaxVisible(maxVisible: number): void;
  setAutocompleteProvider(provider: AutocompleteProvider): void;

  // History (for up/down arrow navigation)
  addToHistory(text: string): void; // Add prompt after successful submission

  // UI state
  isShowingAutocomplete(): boolean;

  invalidate(): void;
  render(width: number): string[];
  handleInput(data: string): void;
}
```

**EditorTheme:**

```typescript
interface EditorTheme {
  borderColor: (str: string) => string;
  selectList: SelectListTheme; // Theme for the autocomplete dropdown
}
```

**EditorOptions:**

```typescript
interface EditorOptions {
  paddingX?: number; // Horizontal padding (default: 0)
  autocompleteMaxVisible?: number; // Max visible autocomplete items
}
```

**Features:** Multi-line editing with word wrap, slash command autocomplete (type `/` at start of line), symbol-based completion (`@`, `#` trigger file/symbol completion), file path autocomplete (Tab key), large paste handling (>10 lines or >1000 chars creates `[paste #N +X lines]` marker), undo with fish-style coalescing, bracketed paste mode, horizontal lines above/below editor, fake cursor rendering. Horizontal scroll when content exceeds width. Vertical scroll when content exceeds terminal height (30% of terminal rows). Prompt history navigation (up/down arrows in empty editor). Character jump mode (`Ctrl+]` forward, `Ctrl+Alt+]` backward — awaits next keypress). Sticky visual column on vertical cursor movement.

---

## Markdown

Renders markdown with syntax highlighting and theming support. Supports headings, bold, italic, code blocks, lists, links, blockquotes, tables, horizontal rules, strikethrough, underline. HTML tags rendered as plain text.

```typescript
class Markdown implements Component {
  constructor(
    text: string,
    paddingX: number,
    paddingY: number,
    theme: MarkdownTheme,
    defaultTextStyle?: DefaultTextStyle,
  );

  setText(text: string): void;
  invalidate(): void;
  render(width: number): string[];
}
```

**MarkdownTheme:**

```typescript
interface MarkdownTheme {
  heading: (text: string) => string;
  link: (text: string) => string;
  linkUrl: (text: string) => string;
  code: (text: string) => string;
  codeBlock: (text: string) => string;
  codeBlockBorder: (text: string) => string;
  quote: (text: string) => string;
  quoteBorder: (text: string) => string;
  hr: (text: string) => string;
  listBullet: (text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  strikethrough: (text: string) => string;
  underline: (text: string) => string;
  highlightCode?: (code: string, lang?: string) => string[]; // Syntax highlighting callback
  codeBlockIndent?: string; // Prefix per code block line (default: "  ")
}
```

**DefaultTextStyle:**

```typescript
interface DefaultTextStyle {
  color?: (text: string) => string;
  bgColor?: (text: string) => string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}
```

Caches rendered output. `highlightCode` receives the code block content and language identifier, returns an array of styled lines.

---

## SelectList

Interactive selection list with keyboard navigation and fuzzy filtering.

```typescript
class SelectList implements Component {
  onSelect?: (item: SelectItem) => void;
  onCancel?: () => void;
  onSelectionChange?: (item: SelectItem) => void;

  constructor(
    items: SelectItem[],
    maxVisible: number,
    theme: SelectListTheme,
    layout?: SelectListLayoutOptions,
  );

  setFilter(filter: string): void; // Filter items by text
  setSelectedIndex(index: number): void; // Programmatically select an item
  getSelectedItem(): SelectItem | null; // Get currently selected item
  invalidate(): void;
  render(width: number): string[];
  handleInput(keyData: string): void;
}
```

**SelectItem:**

```typescript
interface SelectItem {
  value: string;
  label: string;
  description?: string;
}
```

**SelectListTheme:**

```typescript
interface SelectListTheme {
  selectedPrefix: (text: string) => string; // "> " prefix for selected item
  selectedText: (text: string) => string; // Text styling for the selected item
  description: (text: string) => string; // Description text styling
  scrollInfo: (text: string) => string; // Scroll position info styling
  noMatch: (text: string) => string; // "no match" message styling
}
```

**SelectListLayoutOptions:**

```typescript
interface SelectListLayoutOptions {
  minPrimaryColumnWidth?: number; // Minimum width for the label column
  maxPrimaryColumnWidth?: number; // Maximum width for the label column
  truncatePrimary?: (context: {
    text: string;
    maxWidth: number;
    columnWidth: number;
    item: SelectItem;
    isSelected: boolean;
  }) => string;
}
```

**Controls:** Arrow keys navigate, Enter selects, Escape cancels. Supports page up/down for large lists. Items are filtered by fuzzy match when `setFilter()` is called.

---

## SettingsList

Settings panel with value cycling and submenus.

```typescript
class SettingsList implements Component {
  constructor(
    items: SettingItem[],
    maxVisible: number,
    theme: SettingsListTheme,
    onChange: (id: string, newValue: string) => void,
    onCancel: () => void,
    options?: SettingsListOptions,
  );

  updateValue(id: string, newValue: string): void; // Update a setting's value programmatically
  invalidate(): void;
  render(width: number): string[];
  handleInput(data: string): void;
}
```

**SettingItem:**

```typescript
interface SettingItem {
  id: string; // Unique identifier
  label: string; // Display label (left side)
  description?: string; // Shown when selected
  currentValue: string; // Current value to display (right side)
  values?: string[]; // If provided, Enter/Space cycles through these
  submenu?: (
    currentValue: string,
    done: (selectedValue?: string) => void,
  ) => Component; // If provided, Enter opens this submenu
}
```

**SettingsListTheme:**

```typescript
interface SettingsListTheme {
  label: (text: string, selected: boolean) => string;
  value: (text: string, selected: boolean) => string;
  description: (text: string) => string;
  cursor: string; // Character shown for cursor position
  hint: (text: string) => string; // Help text at bottom
}
```

**SettingsListOptions:**

```typescript
interface SettingsListOptions {
  enableSearch?: boolean; // Show search input at top
}
```

**Controls:** Arrow keys navigate, Enter/Space activates (cycles value or opens submenu), Escape cancels. When a setting has `values`, pressing Enter/Space cycles through available values. When it has `submenu`, pressing Enter opens the submenu component. The `done` callback receives the selected value from the submenu.

---

## Spacer

Empty lines for vertical spacing.

```typescript
class Spacer implements Component {
  constructor(lines?: number); // default: 1
  setLines(lines: number): void;
  invalidate(): void;
  render(_width: number): string[];
}
```

---

## Loader

Animated loading spinner that updates every 80ms. Extends `Text`.

```typescript
interface LoaderIndicatorOptions {
  frames?: string[]; // Animation frames (empty array = no indicator)
  intervalMs?: number; // Frame interval in milliseconds
}

class Loader extends Text {
  constructor(
    tui: TUI,
    spinnerColorFn: (str: string) => string,
    messageColorFn: (str: string) => string,
    message?: string,
    indicator?: LoaderIndicatorOptions,
  ); // default message: "Loading..."

  render(width: number): string[];
  start(): void;
  stop(): void;
  setMessage(message: string): void;
  setIndicator(indicator?: LoaderIndicatorOptions): void; // Swap frames/intervals dynamically
}
```

Default frames: `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` at 80ms intervals. Pass `{ frames: [] }` for a static indicator with no animation.

---

## CancellableLoader

Extends `Loader` with Escape key handling and AbortSignal for cancelling async operations.

```typescript
class CancellableLoader extends Loader {
  onAbort?: () => void; // Called when user presses Escape
  signal: AbortSignal; // Aborted when user presses Escape
  aborted: boolean; // Whether the loader was aborted

  constructor(
    tui: TUI,
    spinnerColorFn: (str: string) => string,
    messageColorFn: (str: string) => string,
    message?: string,
    indicator?: LoaderIndicatorOptions,
  );
  handleInput(data: string): void;
  dispose(): void; // Stops animation
}
```

Pattern for async cancellation:

```typescript
const loader = new CancellableLoader(tui, cyan, dim, "Working...");
loader.onAbort = () => done(null);
doWork(loader.signal).then(done);
```

---

## Image

Renders images inline for terminals supporting Kitty graphics protocol (Kitty, Ghostty, WezTerm) or iTerm2 inline images. Falls back to text placeholder on unsupported terminals.

```typescript
class Image implements Component {
  constructor(
    base64Data: string,
    mimeType: string,
    theme: ImageTheme,
    options?: ImageOptions,
    dimensions?: ImageDimensions,
  );

  getImageId(): number | undefined; // Kitty image ID if assigned
  invalidate(): void;
  render(width: number): string[];
}
```

**ImageTheme:**

```typescript
interface ImageTheme {
  fallbackColor: (str: string) => string; // Color for fallback text on unsupported terminals
}
```

**ImageOptions:**

```typescript
interface ImageOptions {
  maxWidthCells?: number; // Maximum width in terminal cells
  maxHeightCells?: number; // Maximum height in terminal cells
  filename?: string; // Filename for fallback display
  imageId?: number; // Reuse existing Kitty image ID (for animations/updates)
}
```

Supported formats: PNG, JPEG, GIF, WebP. Dimensions parsed from image headers automatically. Uses Kitty graphics protocol when available, falls back to iTerm2 inline images, then to text placeholder.
