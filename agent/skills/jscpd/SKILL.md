---
name: jscpd
description: "Finds duplicate code blocks and analyzes duplication metrics across files. Use when identifying copy-pasted code, measuring technical debt, or preparing for refactoring."
---

# jscpd

Copy-paste detector for JavaScript, TypeScript, and many other languages.

## Quick Start

```bash
# Scan a directory, ignoring build artifacts
bunx jscpd --ignore "**/node_modules/**,**/dist/**" src/

# Scan with threshold — exit code 1 if duplication exceeds 5%
bunx jscpd --threshold 5 --ignore "**/node_modules/**,**/dist/**" src/
```

## Common Options

| Option             | Description                              |
| ------------------ | ---------------------------------------- |
| `--min-tokens N`   | Minimum tokens for duplicate detection (default: 50) |
| `--min-lines N`    | Minimum lines for duplicate detection (default: 5) |
| `--threshold N`    | Fail if duplication % exceeds threshold  |
| `--ignore "glob"`  | Ignore patterns (comma-separated)        |
| `--reporters type` | Output format: `console`, `json`, `html` |
| `--output path`    | Output directory for reports             |
| `--silent`         | Suppress console output                  |

## Workflow

1. **Scan**: Run jscpd to detect duplicates
   ```bash
   bunx jscpd --reporters console --ignore "**/node_modules/**,**/dist/**" src/
   ```
2. **Review**: Examine each reported duplicate pair — decide whether to extract a shared function, merge files, or accept the duplication
3. **Refactor**: Extract shared logic into a helper, utility, or base class. Common patterns:
   - Identical functions in multiple files → extract to shared module
   - Similar functions with small differences → parameterize or use generics
   - Repeated config blocks → extract to a shared config file
4. **Verify**: Re-run with a threshold to confirm duplication is within target
   ```bash
   bunx jscpd --threshold 5 --ignore "**/node_modules/**,**/dist/**" src/
   ```
   If the command exits with code 0, duplication is below the threshold.

## Example: JSON Report for CI

```bash
bunx jscpd --reporters json --output ./reports src/
# Produces reports/jscpd-report.json with structured duplicate data
```