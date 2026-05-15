---
name: write
description: "Create a new file with the given content. Use when creating new files from scratch, generating code files, writing configuration, or producing output files."
token_cost: 110
related: [edit, read]
keywords:
  ["write", "create", "new", "save", "draft", "compose", "template", "scaffold"]
---

## Write Tool

Create a **new** file with the given content. Creates parent directories automatically.

REQUIRED: path (absolute), content (full file content)

**Write is for creating new files only.** If the file already exists, Write will be **refused** by the tool and return an error telling you to use Edit instead. Do not retry Write on the same path — it will be refused again.

WHEN TO USE Write:

- The file does not exist yet and you are creating it from scratch

WHEN TO USE Edit INSTEAD:

- ANY change to an existing file — bug fixes, refactors, format tweaks, adding a function, renaming a variable, everything. Edit takes `path` + `edits: [{oldText, newText}]` and patches in place.
- Iterating after a failed test — never retype the whole file

If you need to completely replace an existing file's content, Edit can still do that: pass the entire current content as `oldText` and the full new content as `newText`. Read the file first if you don't already have its current content.

EXAMPLE:

```tool
{"name": "Write", "input": {"path": "/tmp/example/new_module.py", "content": "def hello():\n    return 'hi'\n"}}
```

NOTE: Always use the EXACT file path given in the task, never a placeholder.

## Rules

- Write is for NEW files only — it refuses if the file already exists
- For existing files, always use Edit with `oldText`/`newText` instead
- Parent directories are created automatically
- Use exact paths from the task, never placeholders

## Workflow

1. **Verify file doesn't exist**: Only use Write for files that don't exist yet
2. **Provide full content**: Include the complete file content, not partial updates
3. **Use exact paths**: Match the file path specified in the task exactly
4. **Fallback to Edit**: If Write is refused, use Edit to modify the existing file instead
