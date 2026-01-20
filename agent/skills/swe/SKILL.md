---
name: swe
description: Apply software engineering best practices, design principles, and avoid common anti-patterns. Use when designing systems, reviewing code quality, refactoring legacy code, making architectural decisions, or improving maintainability.
---

# Software Engineering Best Practices

A comprehensive guide to writing maintainable, scalable, and high-quality software, organized by development phase.

## Phases

| Phase | File | Content |
|-------|------|---------|
| Design | [design.md](./design.md) | Requirements, principles, architecture, security by design |
| Implementation | [implementation.md](./implementation.md) | Self-documenting code, naming, functions, error handling, linting, code smells |
| Testing | [testing.md](./testing.md) | Test pyramid, BDD, test quality, anti-patterns |
| Review | [review.md](./review.md) | Code review checklist, self-review before PR |
| Maintenance | [maintenance.md](./maintenance.md) | Refactoring, technical debt, performance, documentation |

## Key Principles Summary

- **Simplicity wins**: Write the simplest code that works; add complexity only when required
- **Single responsibility**: Each function/class/module should do one thing well
- **Self-documenting code**: Code should explain itself; comments are a code smell
- **Fail fast**: Validate inputs early, let unexpected errors propagate
- **Test behavior**: Focus on what code does, not implementation details
- **No backwards compatibility**: Don't add legacy support unless explicitly requested
- **Consistency**: Match existing project conventions over personal preference

## Related Skills and Tools

This skill integrates with other available tools for practical implementation:

| Task | Skill/Tool | Usage |
|------|------------|-------|
| **Code Analysis** | [codemapper](../codemapper/SKILL.md) | Map codebase structure, trace call paths, find callers/callees |
| **Structural Refactoring** | [ast-grep](../ast-grep/SKILL.md) | Search/replace code patterns using AST, safe automated refactoring |
| **Duplicate Detection** | [jscpd](../jscpd/SKILL.md) | Find copy-pasted code blocks across files |
| **Dead Code Detection** | [knip](../knip/SKILL.md) | Find unused dependencies, files, and exports |
| **Testing** | [vitest](../vitest/SKILL.md) | Write and run tests, mocking, coverage reports |
| **Type Safety** | [typescript](../typescript/SKILL.md) | Type definitions, generics, type guards |
| **Python Quality** | [python](../python/SKILL.md) | pytest, ruff, mypy for Python projects |
| **Version Control** | [jujutsu](../jujutsu/SKILL.md) | Track changes, rebase, manage commits |
| **Code Review** | [gh](../gh/SKILL.md) | Create PRs, manage issues, review workflow |
| **Package Management** | [bun](../bun/SKILL.md) | Install dependencies, run scripts, bundle code |
