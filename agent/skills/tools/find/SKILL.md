---
name: find
description: "Find files matching a glob pattern. Use when searching for files by extension, name pattern, or directory structure."
token_cost: 80
related: [grep]
keywords:
  ["glob", "find", "files", "extension", "directory", "discover", "list"]
---

## Glob Tool

Find files matching a glob pattern.

REQUIRED: pattern (glob pattern like "\*_/_.py")
OPTIONAL: path (directory to search in, defaults to cwd)

RULES:

- Use \*\* for recursive matching across directories
- Returns sorted list of matching file paths
- Good for finding files by extension or name pattern

EXAMPLE:

```tool
{"name": "Glob", "input": {"pattern": "**/*.py"}}
```

EXAMPLE with path:

```tool
{"name": "Glob", "input": {"pattern": "*.md", "path": "/path/to/docs/"}}
```

## Workflow

1. **Find by extension**: Use `**/*.ext` for recursive matching (e.g., `**/*.py`)
2. **Scope search**: Use `path` to limit to a specific directory
3. **Combine with grep**: Find files first, then search contents with grep for targeted results
