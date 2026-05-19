---
description: Analyze Python code metrics and refactor complex code
---

Analyze the Python codebase using `radon` and **fix all issues found**. Do not just report problems — resolve them.

**Target**: $1 (default: current directory)
**Options**: $@ (e.g., "--min B" or "-e tests/*.py")

## 1. Cyclomatic Complexity

Detect high-complexity functions:

```bash
uvx radon cc $1 --min B --total-average
```

Complexity ranks:

| CC score | Rank | Risk |
|---|---|---|
| 1–5 | A | low — simple block |
| 6–10 | B | low — well structured |
| 11–20 | C | moderate — slightly complex |
| 21–30 | D | more than moderate |
| 31–40 | E | high — alarming |
| 41+ | F | very high — error-prone |

**Refactor strategies**:

- **Extract functions**: pull branches into named helper functions
- **Early returns**: replace nested conditionals with guard clauses
- **Strategy pattern**: replace large `if/elif` chains with a dispatch dictionary or polymorphism
- **Simplify conditions**: extract complex boolean expressions into well-named variables

Re-check until no blocks rank worse than B.

## 2. Maintainability Index

Detect poorly maintainable files:

```bash
uvx radon mi $1 --min A
```

MI ranks (0–100 scale):

| MI score | Rank | Maintainability |
|---|---|---|
| 100–20 | A | very high |
| 19–10 | B | medium |
| 9–0 | C | extremely low |

**Refactor strategies**:

- Reduce cyclomatic complexity (primary MI driver)
- Remove dead code and unused imports
- Add meaningful comments for complex logic
- Break large files into smaller, focused modules

Re-check until all files rank A.

## 3. Raw Metrics

Review raw metrics for oversized or poorly structured files:

```bash
uvx radon raw $1 --summary
```

Metrics include LOC (total lines), LLOC (logical lines), SLOC (source lines), comments, multiline strings, and blank lines. The invariant `sloc + multi + single_comments + blank = loc` always holds.

**Refactor strategies**:

- Files exceeding 500 SLOC should be split by responsibility
- Modules with low comment ratios for complex logic should add documentation
- Excessive blank lines indicate poor grouping — collapse whitespace

## 4. Halstead Metrics

Detect metrically expensive code:

```bash
uvx radon hal $1 --functions
```

Halstead metrics measure program vocabulary and length, revealing overly verbose or repetitive code blocks.

**Refactor strategies**:

- High Halstead length indicates repetition — extract common logic into helpers
- High difficulty scores signal convoluted expressions — simplify with named intermediates

## Final Verification

Confirm all metrics are within acceptable bounds:

```bash
uvx radon cc $1 --min B --total-average
uvx radon mi $1 --show-cv
```

If both commands report no violations, the codebase is clean.
