---
description: Analyze and fix dead code, duplication, and complexity
---

Analyze the codebase using `fallow` and **fix all issues found**. Do not just report problems — resolve them.

## Analysis

Run the analyzer to identify issues:

```bash
bunx fallow $1 ${@:1}
```

Target specific issue types:

- **Dead code**: `bunx fallow dead-code $1`
- **Duplication**: `bunx fallow dupes $1`
- **Complexity**: `bunx fallow health $1`

## Fixing Issues

**Manual fixes required**:

- **Dead code**: Remove unused exports/files
- **Duplication**: Extract shared logic into reusable utilities
- **Complexity**: Break complex functions into smaller units

## Verification

Re-run analysis to confirm all issues resolved:

```bash
bunx fallow $1 ${@:1}
```
