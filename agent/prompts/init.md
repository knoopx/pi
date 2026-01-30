---
description: Create AGENTS.md documenting build commands, structure, and guidelines for AI agents
---

Create an AGENTS.md file documenting essential project knowledge for AI coding agents.

<objective>
Document the codebase so AI agents can quickly understand build process, structure, and conventions. Target ~150 lines.
</objective>

<sections>
1. **Build Commands** - Build, lint, test, and validate commands
2. **Project Structure** - Directory layout and module boundaries
3. **Entry Points** - Main application entry points
4. **Key Dependencies** - Package manifests and their purpose
</sections>

<existing_config>
Check for existing AI assistant configuration files first:

```bash
# Check for existing rules
cat .cursor/rules/* .cursorrules .github/copilot-instructions.md .claude* 2>/dev/null
```

Incorporate any existing rules into AGENTS.md.
</existing_config>

<discovery_commands>
## Project Structure
```bash
tree -L 2 -I 'node_modules|dist|.git|.next|.cache|coverage|__pycache__|venv|target' .
ls -la
```

## Build System
```bash
ls -la package.json yarn.lock pnpm-lock.yaml Cargo.toml go.mod pyproject.toml 2>/dev/null
cat package.json 2>/dev/null | jq '.scripts' 2>/dev/null
```

## Entry Points
```bash
find . -name "main.*" -o -name "index.*" -o -name "app.*" | grep -v node_modules | head -10
```

## Configuration
```bash
cat tsconfig.json .eslintrc* prettier.config.* 2>/dev/null
```
</discovery_commands>

<validation>
After creating AGENTS.md, verify:
- [ ] All path references are valid
- [ ] Build commands are executable
- [ ] Entry points are correctly identified
- [ ] No duplicate or conflicting information
</validation>

<output_format>
Structure AGENTS.md with these sections:
1. Project Overview
2. Build Commands
3. Project Structure
4. Entry Points & Architecture
5. Dependencies & Packages
6. Code Style Guidelines
</output_format>
