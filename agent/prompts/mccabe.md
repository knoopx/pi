---
description: Detect and refactor high cyclomatic complexity in Python code
---

Find and refactor overly complex Python functions using `mccabe`.

**Target**: $1 (default: current directory)
**Options**: $@ (e.g., "--min 5" or with a flake8 config for max-complexity)

## 1. Scan

Define a helper to run mccabe (it has no standalone CLI, only a Python API):

```bash
run_mccabe() {
  uvx --from mccabe python -c "
import sys, os, glob, mccabe
min_score = 10
target = sys.argv[1] if len(sys.argv) > 1 else '.'
if os.path.isdir(target):
    files = sorted(glob.glob(os.path.join(target, '**', '*.py'), recursive=True))
else:
    files = [target]
for f in files:
    mccabe.main(['--min', str(min_score), f])
" "$@"
}
```

Then scan:

```bash
run_mccabe $1
```

McCabe reports functions with cyclomatic complexity above the threshold, outputting `line:col: 'function_name' score` per file. A score above 10 is considered too complex by McCabe's standard.

## 2. Refactor

For each function exceeding the complexity threshold, apply one of these strategies:

**A. Extract helper functions**:

- Identify branches or sequential blocks that form a cohesive subtask
- Pull the logic into a new named function
- Replace the original block with a call to the helper

**B. Guard clauses and early returns**:

- Invert outer conditionals to return early instead of nesting
- Flatten `if/else` chains by handling the simple case first and returning

**C. Strategy dispatch**:

- Replace long `if/elif` chains that select behavior based on a single value
- Use a dictionary mapping keys to functions or lambdas

**D. Table-driven logic**:

- Replace conditional lookups with data structures (dictionaries, enums)
- Iterate the table instead of branching explicitly

## 3. Flake8 Integration (Optional)

For projects using flake8, mccabe is available as a built-in plugin:

```bash
uvx flake8 --max-complexity 10 $1
```

This emits `C901` errors like `module.py:120:1: C901 'function_name' is too complex (14)`.

Configuration in `pyproject.toml`:

```toml
[tool.flake8]
max-complexity = 10
```

Silence specific violations with `# noqa: C901` on the function definition line — only as a last resort after considering refactoring.

## 4. Verify

Re-run to confirm complexity is within bounds:

```bash
run_mccabe $1
```

No output means all functions are within the acceptable complexity range.
