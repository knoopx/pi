---
description: Refactor code to improve quality while preserving behavior
---

Refactor the specified code to improve quality while preserving behavior.

<target>
$1
</target>

<pre_refactoring>
Before refactoring, analyze the code:

```bash
# Find callers (what depends on this code)
cm callers "$1" . --format ai

# Find callees (what this code depends on)
cm callees "$1" . --format ai

# Check for duplicates
bunx jscpd src/

# Verify test coverage exists
vitest run --coverage
```
</pre_refactoring>

<refactoring_techniques>
| Technique | When to Use |
|-----------|-------------|
| Extract Method | Long method, reusable logic |
| Extract Class | Multiple responsibilities |
| Inline Method | Body is as clear as name |
| Rename | Name doesn't reveal intent |
| Introduce Parameter Object | Long parameter lists |
</refactoring_techniques>

<rules>
1. **Ensure test coverage** before refactoring
2. **Make small, incremental changes**
3. **Run tests after each change**
4. **Commit frequently**
5. **Refactor OR add features**, never both
</rules>

<validation>
After refactoring:
```bash
# Type check
bunx tsc --noEmit

# Lint
bunx eslint src/

# Run tests
vitest run --coverage

# Format
bunx prettier --write "src/**/*.ts"
```
</validation>

<additional_context>
$@
</additional_context>
