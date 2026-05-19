---
description: Find and remove dead Python code
---

Find and remove dead code in the project using `vulture`.

**Target**: $1 (default: current directory)
**Options**: $@ (e.g., "--min-confidence 100" or "--exclude *.py")

## 1. Scan

Run vulture to detect unused code:

```bash
uvx vulture --min-confidence 60 $1 ${@:1}
```

Vulture assigns a confidence value between 60% and 100% for each dead code chunk:

| Code type | Confidence |
|---|---|
| function/method/class argument, unreachable code | 100% |
| import | 90% |
| attribute, class, function, method, property, variable | 60% |

## 2. Review and Refactor

For each category of dead code, apply these strategies:

**A. Unused Imports** (90% confidence):

- Remove the unused `import` statement
- If the import is needed but not directly referenced (e.g., re-exported API), add `# noqa: F401` on the import line

**B. Unused Functions and Methods** (60% confidence):

- Delete the function entirely if nothing calls it
- For dynamically dispatched methods (e.g., framework handlers), suppress with a whitelist file rather than removing the code

**C. Unused Classes** (60% confidence):

- Remove the class and all its unused methods
- If instantiated via `getattr` or string references, create a whitelist to silence vulture

**D. Unused Variables and Attributes** (60% confidence):

- Delete the variable assignment
- For function arguments that cannot be removed (signature constraint), prefix with underscore (`_y`) or use `del y` inside the function body
- Vulture ignores names starting with `_` by default

**E. Unreachable Code** (100% confidence):

- Remove code after `return`, `break`, `continue`, and `raise` statements
- Replace hardcoded `if False:` with a named boolean flag (`debug = False`) for readability

## 3. Handle False Positives

When vulture incorrectly reports used code as dead:

**A. Whitelist file** (recommended):

Generate an automatic whitelist from the scan results:

```bash
uvx vulture $1 --make-whitelist > whitelist.py
```

Then run vulture with the whitelist to suppress false positives:

```bash
uvx vulture $1 whitelist.py
```

**B. Exclude patterns**:

Ignore files or directories by glob pattern:

```bash
uvx vulture $1 --exclude "test_*.py,.venv/*.py,*/docs/*.py"
```

**C. Ignore decorators**:

For framework-specific decorators (e.g., Flask routes):

```bash
uvx vulture $1 --ignore-decorators "@app.route"
```

## 4. Iterate

After removing dead code, run vulture again — it may discover additional dead code:

```bash
uvx vulture --min-confidence 60 $1 ${@:1}
```

Repeat until the output is empty (exit code 0 = no dead code found).

## 5. Verify

Confirm all dead code is resolved:

```bash
uvx vulture --min-confidence 80 $1
```

If the command exits with code 0, the project is clean. Exit code 3 means dead code remains.
