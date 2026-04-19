# Keyboard Handling Reference

## matchesKey

```typescript
function matchesKey(data: string, keyId: KeyId): boolean;
```

Match input data against a key identifier. Supports both legacy terminal sequences and Kitty keyboard protocol. Returns `true` when the raw input matches the given key identifier.

## parseKey

```typescript
function parseKey(data: string): string | undefined;
```

Parse raw input data and return the key identifier string, or `undefined` if unparseable.

## Key Helper Object

Create typed key identifiers with autocomplete:

```typescript
// Special keys (direct properties)
Key.escape      // "escape"  (also aliased as Key.esc → "esc")
Key.enter       // "enter"   (also aliased as Key.return → "return")
Key.tab         // "tab"
Key.space       // "space"
Key.backspace   // "backspace"
Key.delete      // "delete"
Key.insert      // "insert"
Key.clear       // "clear"
Key.home        // "home"
Key.end         // "end"
Key.pageUp      // "pageUp"
Key.pageDown    // "pageDown"

// Arrow keys
Key.up          // "up"
Key.down        // "down"
Key.left        // "left"
Key.right       // "right"

// Function keys
Key.f1 through Key.f12  // "f1" through "f12"

// Symbol keys (direct properties)
Key.backtick      // "`"
Key.hyphen        // "-"
Key.equals        // "="
Key.leftbracket   // "["
Key.rightbracket  // "]"
Key.backslash     // "\\"
Key.semicolon     // ";"
Key.quote         // "'"
Key.comma         // ","
Key.period        // "."
Key.slash         // "/"
Key.exclamation   // "!"
Key.at            // "@"
Key.hash          // "#"
Key.dollar        // "$"
Key.percent       // "%"
Key.caret         // "^"
Key.ampersand     // "&"
Key.asterisk      // "*"
Key.leftparen     // "("
Key.rightparen    // ")"
Key.underscore    // "_"
Key.plus          // "+"
Key.pipe          // "|"
Key.tilde         // "~"
Key.leftbrace     // "{"
Key.rightbrace    // "}"
Key.colon         // ":"
Key.lessthan      // "<"
Key.greaterthan   // ">"
Key.question      // "?"

// Single modifier combinations (takes BaseKey argument)
Key.ctrl("c")     // "ctrl+c"
Key.shift("tab")  // "shift+tab"
Key.alt("x")      // "alt+x"
Key.super("k")    // "super+k"

// Combined modifiers
Key.ctrlShift("p")    // "ctrl+shift+p"
Key.shiftCtrl("p")    // "shift+ctrl+p"
Key.ctrlAlt("x")      // "ctrl+alt+x"
Key.altCtrl("x")      // "alt+ctrl+x"
Key.shiftAlt("x")     // "shift+alt+x"
Key.altShift("x")     // "alt+shift+x"
Key.ctrlSuper("k")    // "ctrl+super+k"
Key.superCtrl("k")    // "super+ctrl+k"
Key.shiftSuper("k")   // "shift+super+k"
Key.superShift("k")   // "super+shift+k"
Key.altSuper("k")     // "alt+super+k"
Key.superAlt("k")     // "super+alt+k"
Key.ctrlShiftAlt("x") // "ctrl+shift+alt+x"
Key.ctrlShiftSuper("k") // "ctrl+shift+super+k"

// Letters and digits also work as base keys
Key.ctrl("a") through Key.ctrl("z")
Key.ctrl("0") through Key.ctrl("9")
```

## KeyEventType

From Kitty keyboard protocol (flag 2):

- `"press"` — key press event (flag value 1)
- `"repeat"` — key repeat event (flag value 2)
- `"release"` — key release event (flag value 3)

## isKeyRelease / isKeyRepeat

```typescript
function isKeyRelease(data: string): boolean; // True if last parsed event was a release
function isKeyRepeat(data: string): boolean; // True if last parsed event was a repeat
```

Only meaningful when Kitty keyboard protocol with flag 2 is active.

## decodeKittyPrintable

```typescript
function decodeKittyPrintable(data: string): string | undefined;
```

Decode a Kitty CSI-u sequence into a printable character. When Kitty protocol flag 1 (disambiguate) is active, terminals send `CSI-u` sequences for all keys including plain printable characters. Only accepts plain or Shift-modified keys — rejects Ctrl, Alt, and other modifier combinations (those are handled by `matchesKey()` instead). Prefers the shifted keycode when Shift is held and a shifted key is reported.

## Kitty Protocol State

```typescript
function setKittyProtocolActive(active: boolean): void; // Set global state (called by ProcessTerminal)
function isKittyProtocolActive(): boolean; // Query current state
```

Set by `ProcessTerminal` automatically after detecting protocol support via the query/response handshake. Falls back to xterm modifyOtherKeys mode 2 on terminals like tmux that may not answer the Kitty query but can forward modified keys.

## Windows VT Input

On Windows, `ProcessTerminal.start()` adds `ENABLE_VIRTUAL_TERMINAL_INPUT` (0x0200) to the stdin console handle so the terminal sends VT sequences for modified keys (e.g., `\x1b[Z` for Shift+Tab). Without this, libuv's `ReadConsoleInputW` discards modifier state and `Shift+Tab` arrives as plain `\t`.

## InputListener

TUI accepts input listeners for intercepting key events before they reach the focused component:

```typescript
type InputListenerResult = { consume?: boolean; data?: string } | undefined;
type InputListener = (data: string) => InputListenerResult;
```

Return `{ consume: true }` to prevent the event from reaching the focused component. Return `{ data: "..." }` to transform the input before forwarding. Return `undefined` for default behavior. Listeners return a cleanup function to remove themselves.
