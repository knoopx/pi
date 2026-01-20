# Init Extension

Command for initializing or improving AGENTS.md files in codebases.

## Installation

No additional installation required.

## Commands

### init

**Description:** Analyze codebase and create/improve AGENTS.md

This command analyzes the current codebase and generates or improves an AGENTS.md file containing:
- Build/lint/test commands (especially for running single tests)
- Code style guidelines including imports, formatting, types, naming conventions, error handling
- Cursor rules (.cursor/rules/ or .cursorrules) if present
- Copilot rules (.github/copilot-instructions.md) if present

The generated file is optimized for agentic coding agents operating in the repository.

**Usage:**
```
init [arguments]
```

**Arguments:** Optional additional instructions for the analysis