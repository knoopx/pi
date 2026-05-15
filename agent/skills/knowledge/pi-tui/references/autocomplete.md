# Autocomplete Reference

## Interfaces

### AutocompleteItem

```typescript
interface AutocompleteItem {
  value: string; // The completion text to insert
  label: string; // Display label
  description?: string; // Optional description
}
```

### SlashCommand

```typescript
interface SlashCommand {
  name: string; // Command name (without leading /)
  description?: string; // Display description
  argumentHint?: string; // Hint shown for command arguments
  getArgumentCompletions?(
    argumentPrefix: string,
  ): Promise<AutocompleteItem[] | null>; // Async completions for command arguments
}
```

### AutocompleteSuggestions

```typescript
interface AutocompleteSuggestions {
  items: AutocompleteItem[];
  prefix: string; // The text that was matched/completed from
}
```

### AutocompleteProvider

Custom autocomplete provider interface:

```typescript
interface AutocompleteProvider {
  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options: { signal: AbortSignal; force?: boolean },
  ): Promise<AutocompleteSuggestions | null>;
  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: AutocompleteItem,
    prefix: string,
  ): { lines: string[]; cursorLine: number; cursorCol: number };
}
```

`getSuggestions()` returns suggestions for the current cursor position. `applyCompletion()` transforms the editor content when a suggestion is accepted — it can replace text, adjust cursor position, or modify other lines.

## CombinedAutocompleteProvider

Supports both slash commands and file path completion in one provider:

```typescript
class CombinedAutocompleteProvider implements AutocompleteProvider {
  constructor(
    commands?: (SlashCommand | AutocompleteItem)[],
    basePath?: string,
    fdPath?: string | null,
  );

  getSuggestions(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    options: { signal: AbortSignal; force?: boolean },
  ): Promise<AutocompleteSuggestions | null>;
  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: AutocompleteItem,
    prefix: string,
  ): { lines: string[]; cursorLine: number; cursorCol: number };

  // File completion specific
  shouldTriggerFileCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
  ): boolean;
}
```

**Features:**

- Type `/` to see slash commands
- Press `Tab` for file path completion
- Supports `~/`, `./`, `../`, and `@` prefix paths
- `@` prefix filters to attachable files (files the terminal can render inline)
- Uses fd for fast file discovery when `fdPath` is provided
- Fuzzy matching on file paths

**Usage with Editor:**

```typescript
const provider = new CombinedAutocompleteProvider(
  [
    { name: "help", description: "Show help" },
    { name: "clear", description: "Clear screen" },
  ],
  process.cwd(), // base path for file completion
  null, // fdPath (null to skip fd, use shell)
);
editor.setAutocompleteProvider(provider);
```

## Fuzzy Matching Utilities

### fuzzyMatch

```typescript
interface FuzzyMatch {
  matches: boolean;
  score: number; // Lower = better match
}

function fuzzyMatch(query: string, text: string): FuzzyMatch;
```

Matches if all query characters appear in order (not necessarily consecutive).

### fuzzyFilter

```typescript
function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[];
```

Filter and sort items by fuzzy match quality (best matches first). Supports space-separated tokens — all tokens must match.
