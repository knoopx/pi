---
description: Detect large files, analyze structure, and split them into sub-modules with clean imports — no barrel files, no dividers required
---

Identify oversized source files and split them into logically grouped sub-modules. No reliance on section dividers or comment markers — use structural analysis of exports, imports, and symbol relationships to determine boundaries.

## Phase 1: Discovery

### Find large production files

```bash
find <dir> -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \) \
  -not -path '*/node_modules/*' -not -name '*.test.*' -not -name '*.spec.*' \
  -exec wc -l {} + | sort -n | tail -20
```

Focus on production code over **400 lines**. No minimum divider count — every large file is a candidate regardless of whether it has section comments.

### Find large test files separately

```bash
find <dir> -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) \
  -not -path '*/node_modules/*' \
  -exec wc -l {} + | sort -n | tail -20
```

Focus on test files over **300 lines**.

### Find unused/orphan files (cleanup target)

```bash
# Files exported from but not imported by anything
grep -rP '^\s*export' --include='*.ts' <dir> | grep -v node_modules | awk -F: '{print $1}' | sort -u > /tmp/exported_files
grep -rP 'from\s*["\x27]' --include='*.ts' <dir> | grep -v node_modules | grep -oP '"[^"]+"' | tr -d '"' | sort -u > /tmp/import_paths

# Find files that are exported but never imported
for f in $(cat /tmp/exported_files); do
  basename=$(basename "$f" .ts)
  dir=$(dirname "$f")
  # Check if any file imports from this path
  grep -rl "from.*$dir/$basename" --include='*.ts' <dir> | grep -v node_modules > /dev/null 2>&1 || echo "$f"
done
```

## Phase 2: Analysis

For each large production file, read the full content and analyze:

1. **Export surface** — list every `export` statement (functions, classes, types, constants)
2. **Internal dependencies** — which exports call/use other exports from the same file
3. **Consumer imports** — run `grep -rn 'from.*<filename>'` to find all importers and what symbols they pull
4. **Cohesion clusters** — group exported symbols by what they share: do they operate on the same types? serve the same consumer? belong to the same logical domain?

Use these signals to determine boundaries (NOT divider comments):

- Symbols that are only used internally by other exports in the same file → move together
- Symbols consumed by different sets of external importers → split point
- Types that are only used within a subset of functions → co-locate with those functions
- Functions that call each other exclusively → keep together
- Distinct concerns (e.g., API fetching vs rendering vs state management) → split

For each large test file, identify:

```bash
grep -n 'describe(' <test-file>
grep -c 'it(' <test-file>   # 0 means orphan (mock definitions only)
```

- Orphan test files (zero `it()` blocks) — check if they're pure helper definitions worth deleting or contributing to the split
- Group tests by describe block and map to which production symbols they cover

## Phase 3: Split Strategy

Apply these rules when designing the split:

1. **Respect existing package boundaries.** Never create new directories at the same level as the target. Split into sub-modules within the existing directory structure or add one-level-deep subdirectories only when justified.
2. **Use nested directories for logical groupings.** `components/changes/index.ts` → `components/changes/state.ts`, `components/changes/navigation.ts`, etc.
3. **Each sub-module should have a single responsibility.** Split by distinct concerns (e.g., data fetching vs rendering vs navigation), not arbitrarily.
4. **NO barrel files.** Every consumer imports directly from the specific module they need. No re-export aggregation files. If `consumer.ts` needs `funcA` and `funcB` from different modules, write two import statements:
   ```ts
   import { funcA } from "./data";
   import { funcB } from "./navigation";
   ```
5. **Preserve the public API surface.** All exported symbols must remain accessible through their new paths. Update every consumer's import statement to point at the correct module.
6. **Keep entry points thin.** If the original file needs to stay as an `index.ts`, it should under 100 lines — but prefer removing it entirely and having consumers import from sub-modules directly.

Test file rules:

- Large test files split to match production structure
- Orphan test files deleted (zero `it()` blocks with no useful shared helpers)
- Test file names match module names: `hooks/engine.ts` → `hooks/engine.test.ts`
- Shared test helpers stay inline in the test file or move to a dedicated test utilities file — never create barrel-style test index files

## Phase 4: Present the Plan

Present before implementing:

| Action         | Files                                          |
| -------------- | ---------------------------------------------- |
| Create         | `path/to/new/module1.ts`, `...`                |
| Delete         | original large file (or thin entry if needed)  |
| Split tests    | `old.test.ts` → `new1.test.ts`, `new2.test.ts` |
| Update imports | ~N consuming files (list each one)             |
| Cleanup        | orphan test files, unused exports              |

Include estimated line counts per new file and the import changes for each consumer.

## Phase 5: Implementation

1. Create new module files with extracted code
2. Update ALL consumer imports — every file that imported from the old path must be updated
3. Delete the original large file
4. Run the build/type checker to verify nothing is broken
5. Fix any type errors or missing imports
6. Run tests to verify behavior is preserved

## Phase 6: Cleanup Leftovers

After splitting, scan for:

1. **Unused exports** — symbols exported from new modules but never imported by anything
2. **Dead import paths** — stale imports in consumers that still reference old module names
3. **Orphan test files** — test files whose production counterparts no longer exist
4. **Duplicate helper code** — if the same helper was copied during a split, consolidate it
5. **Empty directories** — remove empty directories left after file moves

Run: `grep -rn 'from.*old-module-name' --include='*.ts' <dir>` to find any missed import updates.

## Anti-patterns to avoid

- Don't create barrel/re-export aggregation files — consumers import directly from sub-modules
- Don't split into files with only 10–20 lines
- Don't ignore import consumers — count and update every single one
- Don't rename existing exported symbols — only move code, don't refactor names simultaneously
- Don't leave the original large file behind — it must be deleted or reduced to a thin entry point under 100 lines
- Don't rely on divider comments as the sole criterion for splitting — structural analysis is primary
