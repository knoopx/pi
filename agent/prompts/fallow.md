---
description: Analyze and fix dead code, duplication, and complexity
---

Analyze the codebase using `fallow` and **fix all issues found**. Do not just report problems — resolve them.

**Run commands in the correct directory context.** Always `cd` to the project root or the specific package directory before running tools. Running typecheck/lint/test from the wrong directory produces false results.

Run each step **one at a time in order** — do not run multiple steps concurrently or skip ahead. Complete the full cycle of detect → fix → re-check for one issue type before starting the next.

## 1) Duplication (priority over dead code)

Detect duplicated code:

```bash
bunx fallow dupes $1
```

Extract shared logic into reusable utilities, then re-check until clean.

**Focus on duplication first.** "FOCUS ON DUPLICATION NOT DEAD CODE" — duplicate code is a higher priority than unused code because it actively increases maintenance burden and risk of inconsistency.

## 2) Complexity

Detect high-complexity code:

```bash
bunx fallow health $1
```

Break complex functions into smaller units, then re-check until clean.

## 3) Dead Code

Detect dead code:

```bash
bunx fallow dead-code $1
```

Remove unused exports and files, then re-check until clean.

**When removing legacy code: delete entirely with no fallback branches.** If old format migration code is marked for removal, purge it completely. Do not add "if new format else old format" conditionals.

## Final Verification

Confirm everything is resolved:

```bash
bunx fallow $1 ${@:1}
```
