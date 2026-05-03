---
name: codemapper
description: "Analyzes codebases by mapping symbols (functions, classes, methods) using tree-sitter AST parsing. Use when exploring unknown code, finding bugs, understanding call graphs, or validating code health."
---

# codemapper (cm)

CodeMapper maps symbols across your codebase using tree-sitter AST parsing. Everything runs in-memory — no databases. Supports Python, JavaScript/TypeScript, Rust, Java, Go, C, Swift, and Markdown.

## Workflow / Commands

### Exploring Unknown Code

```bash
cm stats .                          # Project size and composition
cm map . --level 2 --format ai      # File structure (compact)
cm query <symbol>                   # Find code (fuzzy by default)
cm inspect ./path/to/file           # Deep dive into one file
```

### Finding a Bug

```bash
cm query <suspected_function> --show-body   # See the implementation
cm callers <function>                       # Who calls this?
cm trace <entry_point> <suspected_function> # Call path A → B
cm tests <function>                         # Find tests for it
```

### Before Refactoring

```bash
cm callers <function>           # Impact radius
cm callees <function>           # What does it depend on?
cm tests <function>             # Verify coverage exists
cm since main --breaking        # Breaking changes vs main
```

### Understanding an API

```bash
cm entrypoints .                # Public surface (exported, no internal callers)
cm implements <interface>       # All implementations
cm schema <DataClass>           # Field structure
```

## Key Commands

### Discovery

```bash
cm stats .                      # File counts, symbol breakdown, parse timing
cm map . --level 2 --format ai  # File listing with symbol counts (levels 1-3)
cm query <symbol>               # Search for functions, classes, methods
cm inspect ./file.rs            # All symbols in one file
cm deps .                       # Import relationships and usage
```

### Call Graph

```bash
cm callers <function>           # Reverse dependencies — who calls this?
cm callees <function>           # Forward dependencies — what does it call?
cm trace <A> <B>                # Shortest call path from A to B
cm entrypoints .                # Exported symbols with no internal callers (dead code?)
cm tests <symbol>               # Test functions that call this symbol
cm untested .                   # Symbols not called by any test
cm impact <symbol>              # Quick breakage report (definition + callers + tests)
cm test-deps ./test_foo.rs      # Production symbols a test file touches
```

### Git History (must be in a git repo)

```bash
cm diff main                    # Symbol-level changes vs a commit
cm since v1.0 --breaking        # Breaking API changes since commit
cm blame <symbol> ./file.rs     # Who last modified this symbol?
cm history <symbol>             # Full evolution of a symbol across commits
```

### Type Analysis

```bash
cm types <function>             # Parameter and return types, where defined
cm implements <Interface>       # All classes/structs implementing an interface
cm schema <Struct>              # Field structure for structs, classes, dataclasses
```

### Snapshots

```bash
cm snapshot save my-checkpoint  # Save current symbol state
cm compare my-checkpoint        # Diff current vs saved snapshot
```

## Common Flags

- `--exact`: Strict matching (default is fuzzy)
- `--format ai`: Compact output, LLM-optimized (recommended)
- `--format human`: Pretty tables for terminal viewing
- `--show-body`: Include actual code, not just signatures
- `--exports-only`: Public symbols only
- `--full`: Include anonymous/lambda functions
- `--context full`: Include docstrings and metadata
- `--no-cache`: Skip cache, always reindex
- `--extensions py,rs`: Comma-separated file types to include

## Details

- **Search modes**: `cm query myclass` (fuzzy, case-insensitive), `cm query MyClass --exact` (case-sensitive), `cm query 'foo|bar'` (OR search).
- **Markdown support**: Headings become hierarchical symbols; endpoint-like routes (e.g. `GET /v1/orders`) are queryable. Use `--section 'Name'` in `inspect` to scope.
- **Caching**: Auto-enabled on projects ≥ 300ms, lives in `.codemapper/`. Small projects never create cache. Override with `--cache-dir` or `CODEMAPPER_CACHE_DIR`.
- **Performance**: Small repos (<100 files) parse in <20ms. Large repos (1000+) auto-enable fast mode for 10-100x speedup.

## Best Practices

- Start with `cm stats .` to understand project composition before deeper queries.
- Use `--format ai` for LLM context — the most token-efficient output.
- Git commands (`diff`, `since`, `blame`, `history`) require a git repo.
