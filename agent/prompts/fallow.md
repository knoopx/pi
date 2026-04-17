---
description: Analyze and fix dead code, duplication, and complexity
---

Analyze the codebase using `fallow` and **fix all issues found**. Do not just report problems — resolve them.

Run each step **one at a time in order** — do not run multiple steps concurrently or skip ahead. Complete the full cycle of detect → fix → re-check for one issue type before starting the next.

## 1) Complexity

Detect high-complexity code:

```bash
bunx fallow health $1
```

Break complex functions into smaller units, then re-check until clean.

## 2) Duplication

Detect duplicated code:

```bash
bunx fallow dupes $1
```

Extract shared logic into reusable utilities, then re-check until clean.

## 3) Dead Code

Detect dead code:

```bash
bunx fallow dead-code $1
```

Remove unused exports and files, then re-check until clean.

## Final Verification

Confirm everything is resolved:

```bash
bunx fallow $1 ${@:1}
```
