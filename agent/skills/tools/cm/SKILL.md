---
name: cm
description: "Map symbols across codebases with codemapper (cm) — tree-sitter AST parsing for call graphs, callers/callees, and entrypoints. Use when exploring unknown code or tracing dependencies."
token_cost: 150
related: [retype, sg, grit]
keywords: ["codemapper", "cm", "symbol", "callers", "callees", "entrypoints"]
---

# codemapper (`cm`)

Maps symbols across your codebase using tree-sitter AST parsing. Everything runs in-memory — no databases. Supports Python, JavaScript/TypeScript, Rust, Java, Go, C, Swift, and Markdown.

## Exploring an Unknown Codebase

Start with project overview, then drill down:

```bash
cm stats .                          # File counts, symbol breakdown, parse timing
cm map . --level 2 --format ai      # File structure with symbol counts (compact)
cm query <symbol>                   # Find functions, classes, methods (fuzzy search)
cm inspect ./path/to/file           # Deep dive into one file
```

## Finding a Bug

Trace the suspected code and its callers:

```bash
cm query <suspected_function> --show-body    # See the implementation
cm callers <function>                        # Who calls this?
cm trace <entry_point> <suspected_function>  # Call path A → B
cm tests <function>                          # Find tests for it
```

## Before Refactoring

Understand impact before changing:

```bash
cm callers <function>           # Reverse dependencies — who calls this?
cm callees <function>           # Forward dependencies — what does it call?
cm tests <function>             # Verify coverage exists
cm since main --breaking        # Breaking changes vs main
```

## Understanding an API Surface

```bash
cm entrypoints .                # Public exported symbols with no internal callers
cm implements <interface>       # All implementations of an interface
cm schema <DataClass>           # Field structure for structs, classes, dataclasses
```

## Git History (requires a git repo)

```bash
cm diff main                    # Symbol-level changes vs a commit
cm since v1.0 --breaking        # Breaking API changes since a tag
cm blame <symbol> ./file.rs     # Who last modified this symbol?
cm history <symbol>             # Full evolution of a symbol across commits
```

## Useful Flags

- `--format ai` — compact output optimized for LLM context (recommended)
- `--show-body` — include actual code, not just signatures
- `--exact` — case-sensitive matching (default is fuzzy)
- `--no-cache` — always reindex

## Rules

- Always start with `cm stats .` to understand project composition
- Use `--format ai` for token-efficient LLM-friendly output
- Git commands (`since`, `blame`, `history`) require a git repository
- Use `--no-cache` to force reindex after structural changes
