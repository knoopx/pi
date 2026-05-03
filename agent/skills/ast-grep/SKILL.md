---
name: ast-grep
description: "Searches and rewrites code using AST patterns. Use when finding code patterns, refactoring at scale, or detecting anti-patterns across a codebase."
---

# ast-grep (`sg`)

Searches code by AST structure, not text. Patterns must be valid parseable code with `$VAR` meta-variables for wildcards.

## Basic Search

```bash
ast-grep run -l ts --pattern 'console.log($X)' src/
ast-grep run --pattern '$FUNC()' agent/extensions/   # Auto-detect language
```

## Pattern Syntax

- `$VAR` — matches a single AST node (uppercase only: `$MOD`, `$_`)
- `$$$VAR` — matches zero or more nodes (function args, statements)
- `$_VAR` — non-capturing (same name can match different content)
- Patterns must be valid code: `import { $X } from "$Y"` works, bare `from $X` fails

## Common Patterns

**Find re-exports (barrel files):**

```bash
ast-grep run -l ts --pattern 'export * from "$Y"' ./
ast-grep run -l ts --pattern 'export { $$$X } from "$Y"' ./
```

**Find all imports from a module:**

```bash
ast-grep run -l ts --pattern 'import { $$$X } from "$MOD"' ./
```

**Find function calls with specific structure:**

```bash
ast-grep run -l ts --pattern 'console.log($MSG)' ./
ast-grep run -l ts --pattern 'fetch($URL).then($H)' ./
```

**Detect anti-patterns (await inside Promise.all):**

```bash
ast-grep run -l ts --pattern 'await $X' ./ \
  --selector call_expression \
  --pattern 'Promise.all($$_)'
```

## Tips

- Use `--debug-query=ast` to see the parsed AST structure
- Patterns fail silently if not parseable — verify with `--debug-query`
- Check [playground](https://ast-grep.github.io/playground.html) for pattern validation
