---
name: codemapper
description: Maps codebase structure, queries symbols, traces call paths, and analyzes dependencies. Use when exploring unfamiliar code, finding function callers/callees, detecting circular imports, or generating project overviews.
---

# Codemapper

Code analysis tool (`cm`) for exploring structure, symbols, dependencies, and call graphs.

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

### Call Graph Analysis

Trace function calls and dependencies:

```bash
# Find callers of a function
cm callers processData . --format ai

# Find callees (what a function calls)
cm callees processData . --format ai

# Analyze dependencies
cm deps . --format ai

# Detect circular dependencies
cm deps . --circular --format ai
```

### Finding Tests

Locate tests for specific functions:

```bash
# Find tests for a function
cm tests functionName . --format ai

# Find untested code
cm untested . --format ai
```

## Related Skills

- **ast-grep**: Structural code searching and refactoring
- **review**: Code review and analysis
- **maintenance**: Code analysis for refactoring
