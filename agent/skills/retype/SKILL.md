---
name: retype
description: Refactors TypeScript codebases with AST-aware rename, extract, and reference finding. Use for moving functions between files, renaming across codebase, or finding all usages of a symbol.
---

# retype-cli

TypeScript refactoring CLI built on ts-morph. AST-aware, safe refactoring.

## Commands

| Command       | Purpose                                   |
| ------------- | ----------------------------------------- |
| `search`      | Find entities (functions, classes, types) |
| `rename`      | Rename entity across all files            |
| `extract`     | Move entity to different file             |
| `references`  | Find all usages of an entity              |
| `unused`      | Find unused exports                       |
| `fix-imports` | Fix missing imports                       |

## Search

```bash
# Find function by name
bunx retype-cli search linearGraphQL -p ./src --list

# Find exported functions only
bunx retype-cli search --kind function --exported -p ./src --list

# Find by regex pattern
bunx retype-cli search "create.*Component" --regex -p ./src --list

# Show code body
bunx retype-cli search myFunction --body -p ./src
```

## References

```bash
# Find all usages of a function
bunx retype-cli references linearGraphQL -p ./src --list

# Show all references (not truncated)
bunx retype-cli references linearGraphQL -p ./src --list --all
```

## Rename

```bash
# Rename with preview (dry run)
bunx retype-cli rename oldName newName -p ./src --preview

# Rename without confirmation
bunx retype-cli rename oldName newName -p ./src --yes

# Exact match only
bunx retype-cli rename oldName newName -p ./src --exact --yes
```

## Extract

Move entity to a different file, updating all imports automatically.

```bash
# Extract function to new file
bunx retype-cli extract linearGraphQL ./src/api/linear.ts -p ./src --yes

# Interactive extraction
bunx retype-cli extract myHelper ./src/utils/helpers.ts -p ./src
```

## Fix Imports

```bash
# Find and fix missing imports
bunx retype-cli fix-imports -p ./src
```

## Unused Exports

```bash
# Find unused exported entities
bunx retype-cli unused -p ./src --list
```

## Common Workflows

### Extract API to separate module

```bash
# 1. Find the function
bunx retype-cli search linearGraphQL -p ./src --list

# 2. Check current references
bunx retype-cli references linearGraphQL -p ./src --list

# 3. Extract to new file (updates all imports)
bunx retype-cli extract linearGraphQL ./src/api/linear.ts -p ./src --yes

# 4. Verify
bun run typecheck
```

### Rename across codebase

```bash
# 1. Preview changes
bunx retype-cli rename createComponent createWidget -p ./src --preview

# 2. Apply changes
bunx retype-cli rename createComponent createWidget -p ./src --yes
```

### Clean up unused exports

```bash
# 1. Find unused
bunx retype-cli unused -p ./src --list

# 2. Review and remove manually
```

## Options

| Option         | Description                   |
| -------------- | ----------------------------- |
| `-p, --path`   | Project root path             |
| `-c, --config` | Path to tsconfig.json         |
| `--list`       | Output as simple list         |
| `--yes`        | Skip confirmation             |
| `--preview`    | Dry run (rename only)         |
| `--exact`      | Exact match (rename only)     |
| `--all`        | Show all results (references) |

## vs ast-grep

| Task                 | retype-cli | ast-grep  |
| -------------------- | ---------- | --------- |
| Rename symbol        | ✅ Best    | ⚠️ Manual |
| Extract to file      | ✅ Best    | ❌ No     |
| Update imports       | ✅ Auto    | ⚠️ Manual |
| Find references      | ✅ Best    | ✅ Good   |
| Pattern-based search | ⚠️ Limited | ✅ Best   |
| Multi-language       | ❌ TS only | ✅ Many   |
| Complex rewrites     | ❌ No      | ✅ Best   |

**Use retype-cli for**: TypeScript refactoring (rename, move, extract)
**Use ast-grep for**: Pattern matching, multi-language, complex rewrites
