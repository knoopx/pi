---
description: Find and remove unused dependencies, files, and exports
---

Find and remove dead code in the project using `knip`.

**Target**: $1 (default: current directory)
**Options**: $@ (e.g., "--production" or "--strict")

## 1. Scan

Run knip to detect unused code:

```bash
bunx knip --reporter compact $1 ${@:1}
```

## 2. Review and Refactor

For each category of unused code, apply these strategies:

**A. Unused Dependencies** (in `package.json`):

- Remove from `dependencies` or `devDependencies`
- If the package is needed but not imported (e.g., type-only), add a `/* @knip used */` comment or configure in `.knip.json`
- For peer dependencies that are truly unused, remove them

**B. Unused Files**:

- Delete files with zero imports/references
- If the file contains unused exports but is an entry point, mark it as such in `.knip.json`
- For test fixtures or data files not imported but used by tests, add to `ignore` patterns

**C. Unused Exports** (functions, types, variables):

- Remove the unused export from the file
- If it's a public API that should be kept, add to `ignoreDependencies` or `ignoreExports` in `.knip.json`
- For barrel exports (`index.ts`), remove the re-export line

**D. Unused Types** (TypeScript):

- Types used only for type annotations are considered "used" by knip
- If a type is truly unused, delete it unless it's part of a public API

## 3. Auto-fix (Optional)

For safe automatic cleanup (removes unused files and dependencies):

```bash
bunx knip --fix $1
```

**Warning**: Review changes before committing. Knip may not understand domain-specific patterns.

## 4. Verify

Re-run to confirm all unused code is removed:

```bash
bunx knip --reporter compact $1
```

If the output shows no results, the project is clean.
