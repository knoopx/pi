name: jscpd
description: |
  Detect and analyze duplicate code in JavaScript, TypeScript, and other languages.

  Use this to:
  - Identify duplicate code blocks across files
  - Analyze code duplication metrics
  - Improve code maintainability by removing redundancy
  - Support refactoring efforts
---

# JSCPD (JavaScript Copy/Paste Detector)

JSCPD is a tool for detecting duplicate code in various programming languages, primarily JavaScript and TypeScript, but supports many others.

## Usage

Run JSCPD on files or directories to detect duplicates:

```bash
bunx jscpd <path> --ignore "**/node_modules/**"
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
