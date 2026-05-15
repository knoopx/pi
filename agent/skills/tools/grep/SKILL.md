---
name: grep
description: "Search file contents with regex using ripgrep. Use when finding code patterns, locating function definitions, searching for imports, or finding references."
token_cost: 100
related: [glob, sg, grit]
keywords:
  [
    "grep",
    "search",
    "pattern",
    "match",
    "regex",
    "ripgrep",
    "occurrence",
    "import",
    "definition",
  ]
---

## Grep Tool

Search file contents with regex. Uses ripgrep.

REQUIRED: pattern (regex pattern)
OPTIONAL: path (directory/file), glob (file glob filter like "\*.py"), ignoreCase (bool), literal (bool — treat pattern as literal text), context (lines of context before/after), limit (max matches, default 100)

RULES:

- Supports full regex syntax (unless `literal: true`)
- Use `glob` to filter by file type (e.g. "_.py", "_.js")
- Use `limit` to cap results; default 100
- Returns matching lines with file path and line number
- Good for finding function definitions, imports, references

EXAMPLE:

```tool
{"name": "Grep", "input": {"pattern": "def main", "glob": "*.py"}}
```

EXAMPLE with path:

```tool
{"name": "Grep", "input": {"pattern": "TODO|FIXME", "path": "/path/to/project/"}}
```

## Workflow

1. **Simple search**: Pass a regex pattern to search all files
2. **Filter by type**: Use `glob` to limit to specific file extensions (e.g., `"*.py"`)
3. **Scope search**: Use `path` to limit to a directory or specific file
4. **Add context**: Use `context` to see lines before/after matches
5. **Cap results**: Use `limit` to control output size (default 100)
