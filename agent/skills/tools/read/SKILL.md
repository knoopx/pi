---
name: read
description: "Read file contents with line numbers. Use when viewing source code, reading configuration files, examining documentation, or inspecting any text file."
token_cost: 100
related: [edit, write]
keywords:
  ["read", "show", "view", "cat", "display", "open", "inspect", "examine"]
---

## Read Tool

Read a file's contents with line numbers.

REQUIRED: path (absolute path)
OPTIONAL: limit (max lines), offset (start line, 0-indexed)

RULES:

- Always use absolute paths, never relative
- Use limit+offset for large files (read in chunks of 100-200 lines)
- Returns format: "N\tline_content" (tab-separated line number + content)

EXAMPLE:

```tool
{"name": "Read", "input": {"path": "/absolute/path/to/file.py"}}
```

EXAMPLE with range:

```tool
{"name": "Read", "input": {"path": "/absolute/path/to/file.py", "limit": 50, "offset": 100}}
```

## Workflow

1. **Use absolute paths**: Always provide the full absolute path to the file
2. **Read in chunks**: For large files, use `limit` and `offset` to read 100-200 lines at a time
3. **Check line numbers**: Output includes line numbers to reference specific locations
4. **Combine with edit**: Read a file before editing to get exact content for `oldText`
