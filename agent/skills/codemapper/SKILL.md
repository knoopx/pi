---
name: codemapper
description: "Analyzes codebases by mapping symbols (functions, classes, methods) using tree-sitter AST parsing. Use when exploring unknown code, finding bugs, understanding call graphs, or validating code health."
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

## Tips

- Start with `cm stats .` to understand project composition before deeper queries
- Use `--format ai` for the most token-efficient output
- Git commands require a git repo; snapshots save current state for later comparison
- Small repos parse in under 20ms; large repos auto-enable fast mode
