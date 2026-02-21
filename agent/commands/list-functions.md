---
description: List all functions in the codebase (excluding tests)
args:
  path:
    description: Path to analyze (defaults to current directory)
    default: "."
  type:
    description: Symbol type filter (function, class, method, enum, all)
    default: "function"
---

List all $type symbols in the codebase, excluding test files.

## Command

```bash
cm query "" --type $type --format ai 2>&1 | grep -v "\.test\.ts" | grep -v "\.spec\.ts"
```

## Output Format

Report the total count and list symbols grouped by file.
