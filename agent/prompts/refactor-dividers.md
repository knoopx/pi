---
description: Find section dividers in source files and split them into focused modules
---

Find source files with section dividers (ASCII `---` or Unicode `─` U+2500) used as inline comment markers, then split each qualifying file into separate modules — one per section.

## Phase 1: Discovery

### Unicode box-drawing dividers (most common)

These are used in comments like `// ── Section ──────────────`:

```bash
# Light horizontal line U+2500 (─) — the most common
grep -rn --exclude-dir=node_modules '// ─' <path>

# Heavy horizontal line U+2501 (━)
grep -rn --exclude-dir=node_modules '━' <path>
```

### Unicode full block of horizontal line characters

If the above misses some files, search the broader Unicode range:

```bash
# All box-drawing horizontal lines: ─ ━ ╌ ╍ ╎ ╏ ┄ ┅ ┆ ┇ ┈ ┉ ┊ ┋ ┌┬┐─│
grep -rnP --exclude-dir=node_modules '[\u2500-\u257F]{3,}' <path>
```

### ASCII dividers in comments

```bash
# Three or more dashes/equals/underscores in comment lines
grep -rn --exclude-dir=node_modules '// [=-]\{3,\}' <path>
grep -rn --exclude-dir=node_modules '# [-=]\{3,\}' <path>
```

### List files by divider count (descending)

```bash
grep -rn --exclude-dir=node_modules '<pattern>' <path> | sed 's/:.*$//' | sort | uniq -c | sort -rn
```

Only consider files with 5+ divider lines or 200+ total lines as candidates.

## Phase 2: Analysis

For each candidate file, read the full content and identify:

1. **Section boundaries** — what each section contains (types, functions, constants)
2. **Export surface** — what is exported from each section vs only used internally
3. **Consumer imports** — run `grep -rn 'from.*<filename>'` to find all importers and what they pull

Then decide: **should this file be split?** Split only if sections contain genuinely independent concerns (e.g., types + utilities, or separate classes). Do NOT split when sections are:

- Methods belonging to the same class
- Nested functions inside a single factory/constructor
- Tightly coupled code where one section calls another exclusively

## Phase 3: Refactoring

For each file that qualifies for splitting:

1. **Create new files** — one per section, with clear naming (e.g., `types.ts`, `utilities.ts`)
   - Export only what consumers need from that section
   - Keep internal helpers private to the file

2. **Update consumer imports** — change direct imports in consumers to point at the specific module:

   ```ts
   // Before
   import { funcA, funcB } from "./big-file";
   // After
   import { funcA } from "./types";
   import { funcB } from "./utilities";
   ```

3. **Create barrel re-export** (backward compat) — keep the original file as a thin re-export layer:

   ```ts
   export { type A } from "./types";
   export { funcB } from "./utilities";
   ```

   This lets existing imports continue working while new code uses focused imports.

4. **Update test files** — change their imports to match the new structure, or keep them via the barrel if they exercise cross-section behavior.

## Phase 4: Verification

Run the project's type checker and test suite. If anything fails, fix it before moving on. Do not proceed with other files until the current one is clean.

## Key principles

- Each new file should be independently readable — a reader of `types.ts` shouldn't need to open `utilities.ts` to understand what's exported
- Prefer fewer, larger files over many tiny ones — only split when sections have clear boundaries
- The barrel file is temporary scaffolding, not architecture — document its purpose in a comment
