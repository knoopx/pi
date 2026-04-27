---
description: Scan and fix AI-generated code smells using vibecheck
---

Scan the codebase for AI-generated code smells using `vibecheck` and **fix all issues found**. Do not just report problems — resolve them.

Run each step **one at a time in order** — do not run multiple steps concurrently or skip ahead. Complete the full cycle of detect → fix → re-check before moving on.

## 1) Scan

Detect AI slop patterns across the codebase:

```bash
bunx @yuvrajangadsingh/vibecheck $1
```

Review every reported issue and apply fixes by severity:

### Errors (must fix)

- **no-hardcoded-secrets** — Move secrets to environment variables or `.env` files
- **no-eval** — Replace `eval()` / `new Function()` with safe alternatives
- **no-sql-concat** — Use parameterized queries or query builders
- **no-empty-catch** — Log the error, rethrow, or handle it explicitly
- **no-error-info-leak** — Never expose `err.message` or `err.stack` to clients
- **no-py-eval** — Replace `eval()`, `exec()`, `os.system()` with safe alternatives
- **no-py-sql-concat** — Use parameterized queries instead of f-string SQL
- **no-bare-except** — Specify the exception type (`except ValueError:`)
- **no-pass-except** — Replace `except: pass` with actual error handling

### Warnings (should fix)

- **no-innerhtml** — Use safe DOM APIs or sanitize input
- **no-console-error-only** — Rethrow after logging or handle the error properly
- **no-swallowed-promise** — Add `.catch()` or use `try/catch` with `await`
- **no-console-pollution** — Replace `console.log` with proper logging or remove it
- **no-god-function** — Split functions over 80 lines into smaller units
- **no-ts-any** — Replace `any` types and `as any` casts with specific types
- **no-express-unhandled** — Wrap async Express route handlers in error handling middleware
- **no-flask-debug** — Remove `debug=True` from production Flask config
- **no-star-import** — Import specific names instead of `from module import *`
- **no-mutable-default** — Use `None` as default and initialize inside the function
- **no-py-print** — Replace `print()` with proper logging or remove it
- **no-type-ignore-blanket** — Specify the error code (`# type: ignore[assignment]`)

### Info (clean up)

- **no-ai-todo** — Implement the TODO or remove it if no longer relevant
- **no-obvious-comments** — Remove comments that restate what the code already says
- **no-py-obvious-comments** — Remove comments that restate what the code already says

## 2) Re-check

After fixing all issues, confirm the scan is clean:

```bash
bunx @yuvrajangadsingh/vibecheck $1 ${@:1}
```

If new issues appear from your fixes, iterate until clean.
