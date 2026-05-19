---
description: Lint Python code for style, errors, and complexity using flake8
---

Find and fix Python linting issues using `flake8`.

**Target**: $1 (default: current directory)
**Options**: $@ (e.g., "--max-line-length 100" or "--select E,F")

## 1. Scan

Run flake8 to detect all issues:

```bash
uvx flake8 --max-complexity 10 $1 ${@:1}
```

Flake8 bundles three checkers by default:

| Prefix | Plugin | What it checks |
|---|---|---|
| E, W | pycodestyle | PEP 8 style violations |
| F | pyflakes | Logical errors, undefined names, unused imports |
| C901 | mccabe | Cyclomatic complexity |

Common error codes:

| Code | Description |
|---|---|
| E501 | Line too long |
| E722 | Do not use bare `except` |
| F401 | Module imported but unused |
| F821 | Undefined name |
| F841 | Local variable assigned but never used |
| C901 | Function too complex |

## 2. Refactor

For each category of violation, apply these strategies:

**A. Unused Imports** (F401):

- Remove the unused `import` statement
- If the import is a re-exported API, add `# noqa: F401` on the import line

**B. Undefined Names** (F821):

- Add the missing import or variable definition
- If the name comes from a dynamic context (e.g., framework injection), add to `--builtins`

**C. Unused Variables** (F841):

- Delete the unused assignment
- For intentional placeholders, prefix with underscore (`_unused`)

**D. Bare Excepts** (E722):

- Replace `except:` with `except Exception:` or a specific exception type
- For intentional catch-all handlers, use `except BaseException:`

**E. Line Too Long** (E501):

- Break long expressions across multiple lines using parentheses
- Use the project's configured `--max-line-length` (default 79)

**F. High Complexity** (C901):

- Extract branches into named helper functions
- Replace nested conditionals with guard clauses and early returns
- Use strategy dispatch dictionaries for long `if/elif` chains

## 3. Configuration

For persistent settings, use `pyproject.toml`:

```toml
[tool.flake8]
max-line-length = 100
max-complexity = 10
extend-ignore = ["E203", "W503"]
exclude = [".venv", "__pycache__", "build"]
```

Or a dedicated `.flake8` file:

```ini
[flake8]
max-line-length = 100
max-complexity = 10
extend-ignore = E203, W503
exclude = .venv, __pycache__, build
```

## 4. Selective Checks

Run only specific check categories:

```bash
# Only logical errors (pyflakes)
uvx flake8 --select F $1

# Only style violations (pycodestyle)
uvx flake8 --select E,W $1

# Only complexity (mccabe)
uvx flake8 --select C901 $1
```

## 5. Verify

Re-run to confirm all issues are resolved:

```bash
uvx flake8 --max-complexity 10 $1
```

Exit code 0 with no output means the codebase is clean. Exit code 1 indicates remaining violations.
