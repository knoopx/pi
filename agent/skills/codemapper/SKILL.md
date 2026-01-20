---
name: codemapper
description: Map codebase structure, query symbols, trace call paths, and analyze dependencies. Use when exploring unfamiliar code, finding function callers/callees, detecting circular imports, or generating project overviews.
---

# Codemapper

Code analysis tool (`cm`) for exploring structure, symbols, dependencies, and call graphs. Supports Python, JavaScript, TypeScript, Go, Rust, Java, C, C++, C#, Ruby, PHP, YAML.

## Contents

- [Usage](#usage)
- [Code Statistics](#code-statistics)
- [Code Map](#code-map)
- [Query Symbols](#query-symbols)
- [Inspect File](#inspect-file)
- [Find Callers/Callees](#find-callers-reverse-dependencies)
- [Trace Call Path](#trace-call-path)
- [Analyze Dependencies](#analyze-dependencies)
- [Git Integration](#git-integration)
- [Common Workflows](#common-workflows)

## Usage

All commands support `--format ai` for concise, AI-friendly output.

### Code Statistics

Get comprehensive statistics about a codebase:

```bash
# Current directory
cm stats . --format ai

# Specific directory
cm stats ./src --format ai
```

Output includes file counts, lines of code, and language distribution.

### Code Map

Generate a hierarchical overview of the codebase structure:

```bash
# Basic overview (level 2 detail)
cm map . --level 2 --format ai

# Detailed structure
cm map . --level 3 --format ai

# Exports only (public API)
cm map . --level 2 --exports-only --format ai

# Specific directory
cm map ./src --level 2 --format ai
```

Detail levels:
- Level 1: Files and directories only
- Level 2: Files with exported symbols
- Level 3: Files with all symbols and details

### Query Symbols

Search for functions, classes, and symbols:

```bash
# Fuzzy search
cm query authenticate . --format ai

# Exact match
cm query User . --exact --format ai

# Show implementation bodies
cm query validate . --show-body --format ai

# Public symbols only
cm query process . --exports-only --format ai
```

### Inspect File

Examine the structure and symbols within a specific file:

```bash
cm inspect ./src/auth.ts --format ai
cm inspect ./models/user.py --format ai
```

Shows imports, exports, functions, classes, and their relationships.

### Find Callers (Reverse Dependencies)

Find all locations where a symbol is used:

```bash
# Who calls this function?
cm callers authenticate . --format ai

# Find class usages
cm callers UserService . --format ai

# Find method references
cm callers process_payment . --format ai
```

### Find Callees (Forward Dependencies)

Find all symbols called by a specific function:

```bash
# What does this function call?
cm callees process_order . --format ai

# Analyze complex function
cm callees handle_request . --format ai
```

### Trace Call Path

Find the call path between two symbols:

```bash
# How does main reach authenticate?
cm trace main authenticate . --format ai

# Debug data flow
cm trace handle_request save_database . --format ai

# Analyze call chains
cm trace process_order send_notification . --format ai
```

### Analyze Dependencies

Examine import and dependency relationships:

```bash
# File imports
cm deps ./src/auth.py --format ai

# Reverse dependencies (who imports this?)
cm deps ./utils.js --direction used-by --format ai

# Limit depth
cm deps ./src/main.ts --depth 3 --format ai

# External packages
cm deps . --external --format ai

# Find circular dependencies
cm deps . --circular --format ai
```

### Git Integration

Analyze changes and history:

```bash
# Symbol-level diff vs commit
cm diff main --format ai

# Breaking changes since release
cm since v1.0 --breaking --format ai

# Who last modified a symbol
cm blame authenticate ./auth.py --format ai

# Evolution of a symbol
cm history authenticate ./auth.py --format ai
```

### Type Analysis

Understand data structures and implementations:

```bash
# Parameter and return types
cm types process_payment . --format ai

# Find interface implementations
cm implements Iterator . --format ai

# Field structure of data classes
cm schema Order . --format ai
```

### Test Coverage

Find untested code:

```bash
# Find tests for a symbol
cm tests authenticate . --format ai

# Find uncovered symbols
cm untested . --format ai

# What production code does a test touch
cm test-deps ./tests/test_auth.py --format ai
```

### Snapshots

Compare code over time:

```bash
# Save current state
cm snapshot --name before-refactor

# Compare with snapshot
cm compare before-refactor --format ai
```

## Common Workflows

### Explore Unfamiliar Codebase

```bash
# 1. Get overview statistics
cm stats . --format ai

# 2. Generate structure map
cm map . --level 2 --format ai

# 3. Find entry points
cm query main . --format ai

# 4. Trace from entry point
cm callees main . --format ai
```

### Understand a Function

```bash
# 1. Find the function
cm query authenticate . --show-body --format ai

# 2. See who uses it
cm callers authenticate . --format ai

# 3. See what it calls
cm callees authenticate . --format ai
```

### Safe Refactoring

```bash
# 1. Find all usages before changing
cm callers old_function . --format ai

# 2. Check dependencies
cm deps ./src/module.ts --format ai

# 3. Trace impact
cm trace old_function critical_operation . --format ai
```

### Detect Architecture Issues

```bash
# Find circular dependencies
cm deps . --circular --format ai

# List external dependencies
cm deps . --external --format ai

# Check module coupling
cm deps ./src/core.ts --direction used-by --format ai
```

### Review Public API

```bash
# List all exports
cm map . --level 2 --exports-only --format ai

# Query specific export
cm query MyPublicClass . --exact --exports-only --format ai
```

## Output Formats

- `--format ai`: Concise, structured output optimized for AI processing
- `--format json`: Machine-readable JSON output
- `--format text`: Human-readable text (default)

## Tips

- Use `--format ai` for all commands when working with AI assistants
- Start with `cm stats` and `cm map` to understand project scope
- Use `cm callers` before renaming or removing functions
- Check `cm deps --circular` regularly to prevent dependency issues
- Combine `cm trace` with debugging to understand complex flows

## Related Skills

- **ast-grep**: Use ast-grep for structural code search and automated refactoring.
- **knip**: Detect unused exports and dependencies to complement code analysis.
- **jscpd**: Find duplicate code patterns in the analyzed codebase.
