---
name: retype
description: "Refactors TypeScript codebases with AST-aware rename, extract, and reference finding. Use for moving functions between files, renaming across codebase, or finding all usages of a symbol."
token_cost: 150
keywords: ["rename", "extract", "retype", "reference", "typescript"]
---

# retype-cli

TypeScript refactoring built on ts-morph. AST-aware — safe renames, extractions, and reference finding across the entire codebase.

## Finding Symbols

Search for functions, classes, or types:

```bash
bunx retype-cli search linearGraphQL -p ./src --list
bunx retype-cli search "create.*Component" --regex -p ./src --list
bunx retype-cli search myFunction --body -p ./src   # Show code body
```

## Finding References

See every usage of a symbol:

```bash
bunx retype-cli references linearGraphQL -p ./src --list
bunx retype-cli references linearGraphQL -p ./src --list --all  # Don't truncate
```

## Renaming

Preview changes before applying:

```bash
bunx retype-cli rename oldName newName -p ./src --preview
bunx retype-cli rename oldName newName -p ./src --yes   # Apply without confirmation
bunx retype-cli rename oldName newName -p ./src --exact --yes  # Exact match only
```

## Extracting to New Files

Move a symbol to a different file, updating all imports automatically:

```bash
bunx retype-cli extract linearGraphQL ./src/api/linear.ts -p ./src --yes
```

## Fixing Imports & Finding Unused Exports

```bash
bunx retype-cli fix-imports -p ./src        # Fix missing imports
bunx retype-cli unused -p ./src --list      # Find unused exports
```

## Typical Workflow: Extract a Module

1. Find the function: `bunx retype-cli search linearGraphQL -p ./src --list`
2. Check references: `bunx retype-cli references linearGraphQL -p ./src --list`
3. Extract to new file: `bunx retype-cli extract linearGraphQL ./src/api/linear.ts -p ./src --yes`
4. Verify with typecheck

## Typical Workflow: Rename Across Codebase

1. Preview changes: `bunx retype-cli rename createComponent createWidget -p ./src --preview`
2. Apply: `bunx retype-cli rename createComponent createWidget -p ./src --yes`
