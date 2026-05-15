# Utility Functions Reference

## Text Width & Truncation

### visibleWidth

```typescript
function visibleWidth(str: string): number;
```

Calculate the visible width of a string in terminal columns. Ignores ANSI escape codes and handles wide characters correctly. Use to measure text before truncating or padding.

```typescript
visibleWidth("\x1b[31mHello\x1b[0m"); // 5 (not counting ANSI codes)
visibleWidth("日本語"); // 6 (each CJK char = 2 columns)
```

### truncateToWidth

```typescript
function truncateToWidth(
  text: string,
  maxWidth: number,
  ellipsis?: string,
  pad?: boolean,
): string;
```

Truncate text to fit within `maxWidth` visible columns. Adds `ellipsis` (default `"..."`) when truncated. Optionally pads with spaces to reach exactly `maxWidth`. Properly handles ANSI escape codes — they don't count toward width and are preserved/closed correctly.

```typescript
truncateToWidth("Hello World", 8); // "Hello..."
truncateToWidth("Hello World", 8, ""); // "Hello Wo"
truncateToWidth("Hello World", 12, "", true); // "Hello World " (padded to 12)
truncateToWidth(chalk.red("Hello") + " " + chalk.blue("World"), 8); // Styled "Hello..." with proper resets
```

### sliceByColumn / sliceWithWidth

```typescript
function sliceByColumn(
  line: string,
  startCol: number,
  length: number,
  strict?: boolean,
): string;
function sliceWithWidth(
  line: string,
  startCol: number,
  length: number,
  strict?: boolean,
): { text: string; width: number };
```

Extract a range of visible columns from a line. Handles ANSI codes and wide characters. `strict` mode excludes wide characters at boundaries that would extend past the range. `sliceWithWidth` additionally returns the actual visible width of the extracted result.

### extractSegments

```typescript
function extractSegments(
  line: string,
  beforeEnd: number,
  afterStart: number,
  afterLen: number,
  strictAfter?: boolean,
): { before: string; beforeWidth: number; after: string; afterWidth: number };
```

Extract "before" and "after" segments from a line in a single pass. Used for overlay compositing where content exists before and after the overlay region. Preserves styling from the "before" section that should affect content after it.

## Text Wrapping

### wrapTextWithAnsi

```typescript
function wrapTextWithAnsi(text: string, width: number): string[];
```

Word-wrap text while preserving ANSI codes across line breaks. Only does word wrapping — no padding or background colors. Returns lines where each line is at most `width` visible characters. Active ANSI codes are preserved across line breaks.

```typescript
wrapTextWithAnsi("This is a long line that needs wrapping", 20);
// ["This is a long line", "that needs wrapping"]
```

Use this when rendering multi-line styled text so styles carry across wrapped lines. The TUI appends a full SGR reset after each rendered line — `wrapTextWithAnsi` ensures ANSI codes are closed and reopened for each wrapped segment.

### applyBackgroundToLine

```typescript
function applyBackgroundToLine(
  line: string,
  width: number,
  bgFn: (text: string) => string,
): string;
```

Apply background color to a line, padding to full width. The `bgFn` receives the text and returns it with a background ANSI code applied. Pads the result with spaces to exactly `width`.

## Character Utilities

### isWhitespaceChar / isPunctuationChar

```typescript
function isWhitespaceChar(char: string): boolean;
function isPunctuationChar(char: string): boolean;
```

Check if a character is whitespace or punctuation. Used internally by word-wrapping and text layout logic.

## ANSI Code Extraction

### extractAnsiCode

```typescript
function extractAnsiCode(
  str: string,
  pos: number,
): { code: string; length: number } | null;
```

Extract the ANSI escape sequence at position `pos` in string `str`. Returns the escape code and its total byte length, or `null` if no ANSI code starts at that position.

## Grapheme Segmentation

### getSegmenter

```typescript
function getSegmenter(): Intl.Segmenter;
```

Get the shared grapheme segmenter instance. Used for proper text wrapping around emoji and complex characters. The Editor component uses this internally with paste-marker awareness for accurate segmentation when paste markers are present in the text.

## StdinBuffer

```typescript
type StdinBufferOptions = { timeout?: number }; // Max wait for sequence completion (default: 10ms)
type StdinBufferEventMap = { data: [string]; paste: [string] };

class StdinBuffer extends EventEmitter<StdinBufferEventMap> {
  constructor(options?: StdinBufferOptions);
  process(data: string | Buffer): void; // Feed input data
  flush(): string[]; // Get accumulated complete sequences
  clear(): void; // Clear buffer
  getBuffer(): string; // Get raw buffer contents
  destroy(): void; // Clean up and destroy
}
```

Buffers stdin input and emits complete sequences via `data` and `paste` events. Necessary because stdin data events can arrive in partial chunks, especially for escape sequences like mouse events. Flushes after the timeout even if incomplete. Used by `ProcessTerminal` to split batched input into individual sequences before forwarding to TUI components.
