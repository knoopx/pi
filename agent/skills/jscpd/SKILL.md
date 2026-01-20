---
name: jscpd
description: Find duplicate code blocks and analyze duplication metrics across files. Use when identifying copy-pasted code, measuring technical debt, or preparing for refactoring.
---

# jscpd

Duplicate code detector supporting 150+ languages.

## Usage

```bash
# Analyze directory
npx jscpd /path/to/source

# With pattern filter
npx jscpd --pattern "src/**/*.js" .

# Ignore directories
npx jscpd --ignore "**/node_modules/**,**/dist/**" .

# Minimum tokens to match (default: 50)
npx jscpd --min-tokens 30 .

# Output formats
npx jscpd --reporters json --output report.json .
npx jscpd --reporters html --output ./report/ .
```

## Common Options

| Option | Description |
|--------|-------------|
| `--min-tokens N` | Minimum tokens for duplicate detection |
| `--min-lines N` | Minimum lines for duplicate detection |
| `--threshold N` | Fail if duplication % exceeds threshold |
| `--ignore "glob"` | Ignore patterns (comma-separated) |
| `--reporters type` | Output format: `console`, `json`, `html` |
| `--output path` | Output directory for reports |
| `--silent` | Suppress console output |

## Workflow

1. Run jscpd to find duplicates
2. Review the reported duplicates
3. Refactor to eliminate duplication
4. Re-run to verify cleanup
