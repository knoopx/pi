# codemapper Reference

Detailed patterns, examples, and workflows for codemapper.

## Code Map Patterns

### Project Overview

```bash
# Get overview of entire project
cm map . --level 2 --format ai

# Get detailed overview
cm map . --level 3 --format ai

# Get overview of specific directory
cm map ./src --level 2 --format ai
```

### Public API Overview

```bash
# Get only exported symbols (public API)
cm map . --level 2 --exports-only --format ai

# Get public symbols with implementation bodies
cm map . --level 2 --exports-only --show-body --format ai
```

## Query Patterns

### Symbol Search

```bash
# Fuzzy search for symbols
cm query authenticate . --format ai
cm query User . --format ai
cm query process . --format ai

# Exact match
cm query User . --exact --format ai

# Show implementation bodies
cm query validate . --show-body --format ai

# Public symbols only
cm query process . --exports-only --format ai
```

## Dependency Analysis Patterns

### Find Callers

```bash
# Find what calls a function
cm callers functionToCall . --format ai

# Find what calls a class method
cm callers UserService.get . --format ai
```

### Find Callees

```bash
# Find what a function calls
cm callees functionToCall . --format ai

# Find what a class uses
cm callees UserService . --format ai
```

### Trace Call Path

```bash
# Trace call path from entry point to function
cm call-path functionToFind . --format ai

# Trace call path from function to entry point
cm call-path functionToFind --reverse --format ai
```

### Analyze Dependencies

```bash
# List all dependencies
cm deps . --format ai

# Check for circular dependencies
cm deps . --circular --format ai

# Find unused dependencies
cm deps . --unused --format ai

# Find unused symbols
cm deps . --unused-symbols --format ai
```

## Git Integration

### Git Workflow

```bash
# Map changes since last commit
cm map . --level 2 --format ai

# Query symbols in changed files
cm query process . --format ai

# Analyze dependencies in changed files
cm deps . --format ai
```

## Common Workflows

### Code Exploration

```bash
# Get project overview
cm map . --level 2 --format ai

# Find specific symbols
cm query User . --format ai

# Understand dependencies
cm deps . --format ai
```

### Refactoring Preparation

```bash
# Check test coverage
cm tests functionToRefactor . --format ai

# Find callers to update
cm callers functionToRefactor . --format ai

# Find callees to update
cm callees functionToRefactor . --format ai

# Check for circular dependencies
cm deps . --circular --format ai
```

## Tips

- Use `--format ai` for concise output
- Use `--level 2` for overview, `--level 3` for details
- Use `--exports-only` to see public API
- Use `--show-body` to see implementation details
- Use `--exact` for precise matching
- Use `--circular` to check for dependency issues
- Use `--unused` to find unused code
- Use `--unused-symbols` to find unused symbols
- Use `--query` to search for symbols
- Use `--callers` to find callers
- Use `--callees` to find callees
- Use `--call-path` to trace call paths
- Use `--deps` to analyze dependencies
- Use `--stats` to get code statistics
- Use `--map` to generate structure
