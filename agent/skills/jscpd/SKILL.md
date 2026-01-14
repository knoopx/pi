---
name: jscpd
description: Detect and analyze duplicate code in JavaScript, TypeScript, and other languages.
---

# JSCPD (JavaScript Copy/Paste Detector)

JSCPD is a tool for detecting duplicate code in various programming languages, primarily JavaScript and TypeScript, but supports many others.

## Setup

No setup required. JSCPD is run on-demand using `bunx`.

## Usage

Run JSCPD on files or directories to detect duplicates:

```bash
bunx jscpd <path>
```

Common options:

- `--min-lines <number>`: Minimum lines for a duplicate block (default: 5)
- `--min-tokens <number>`: Minimum tokens for a duplicate block (default: 50)
- `--format <format>`: Output format (console, json, xml, html, etc.)
- `--ignore <pattern>`: Ignore files matching pattern
- `--reporters <reporters>`: Specify reporters (console, json, etc.)

Example:

```bash
bunx jscpd src/ --min-lines 10 --format json
```

## Workflow

1. Identify the codebase or files to analyze
2. Run JSCPD with appropriate options
3. Review the reported duplicates
4. Refactor duplicate code to improve maintainability

## Supported Languages

JSCPD supports detection in languages like JavaScript, TypeScript, Python, Java, C++, and more. It analyzes source code files and reports duplicate blocks based on token sequences.

## Related Skills

- **typescript**: Detect duplicate code in TypeScript projects to improve maintainability.
- **python**: Identify duplicate code patterns in Python codebases.
