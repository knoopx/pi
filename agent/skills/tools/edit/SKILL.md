---
name: edit
description: "Replace exact text in a file. Use when modifying existing files with precise text replacement, making targeted edits, or deleting code."
token_cost: 150
related: [read, write]
keywords:
  [
    "edit",
    "fix",
    "modify",
    "update",
    "patch",
    "change",
    "replace",
    "amend",
    "correct",
    "adjust",
  ]
---

## Edit Tool

Replace exact text in a file. This is the **default tool for changing any existing file** — prefer it over Write for anything except creating a new file from scratch.

REQUIRED: path (absolute), edits (array of {oldText, newText})
OPTIONAL: none

RULES:

- Each `oldText` must match EXACTLY (whitespace, indentation, line endings all matter)
- Each `oldText` must be unique in the file — include 2-3 lines of surrounding context if needed
- `edits` is matched against the **original** file, not after earlier edits apply — do not overlap or nest
- To delete text: set `newText` to ""
- Read the file first if you do not already have its current content
- Batch multiple disjoint changes in one call by passing multiple `edits[]` entries

EXAMPLE (single change):

```tool
{"name": "Edit", "input": {"path": "/absolute/path/file.py", "edits": [{"oldText": "def hello():\n    return 1", "newText": "def hello():\n    return 2"}]}}
```

EXAMPLE (two changes in one call):

```tool
{"name": "Edit", "input": {"path": "/absolute/path/file.py", "edits": [{"oldText": "MAX = 10", "newText": "MAX = 20"}, {"oldText": "TIMEOUT = 5", "newText": "TIMEOUT = 30"}]}}
```

RECOVERY WHEN Edit FAILS:

- "String not found" → Read the file to get the exact current content (whitespace often differs), then retry Edit with the exact string
- "Found multiple times" → include more surrounding context so `oldText` is unique, then retry Edit
- Do NOT fall back to Write just because Edit failed once — re-read, fix `oldText`, retry. Write is almost always the wrong recovery here for an existing file.

## Workflow

1. **Read first**: Always read the file to get exact current content before editing
2. **Match exactly**: Ensure `oldText` matches precisely (whitespace, indentation, line endings)
3. **Ensure uniqueness**: Include 2-3 lines of surrounding context if the text appears multiple times
4. **Batch changes**: Pass multiple `edits[]` entries for disjoint changes in one call
5. **Handle failures**: Re-read on "String not found"; add context on "Found multiple times"
