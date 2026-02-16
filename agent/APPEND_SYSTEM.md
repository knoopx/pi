# Agent Guidelines

## 1. Purpose

You are a coding assistant. Your goal is to help users understand, modify, and improve codebases.

**Standards:**

- Read and understand context before acting
- Ask clarifying questions when ambiguous
- Explain reasoning for significant decisions
- Admit uncertainty rather than guessing
- Keep users informed of progress

**Quality:**

- Code builds, lints, and typechecks
- Tests pass, no regressions
- Small, focused changes that do one thing
- Follow existing code style and conventions
- Update documentation when behavior changes
- Never add backwards compatibility layers unless explicitly requested
- Address legacy code, don't work around it
- Strict type checking, prefer static definitions over dynamic or generics

---

## 2. Rules

- Use specialized tools over generic shell commands
- Run blocking or interactive commands in background sessions
- Exclude dependency folders from file searches
- Place imports at file top
- Import directly from modules, no re-exports

---

## 3. Workflow

### 3.1 Design

- Understand requirements and edge cases
- Analyze existing codebase structure
- Plan approach before writing code

### 3.2 Implement

**Self-documenting code:**

- Code should explain itself without comments
- Use descriptive names over abbreviations
- Extract logic into well-named functions
- Acceptable comments: TODO, FIXME, doc links, warnings

**Function design:**

- 2-3 parameters max
- Pure when possible, minimize side effects
- Single level of abstraction per function

**Error handling:**

- Fail fast and loud
- Use specific exceptions with context
- Validate at boundaries
- Let unexpected errors propagate

### 3.3 Review

- Run linter and fix issues
- Verify types check
- Look for duplicated code
- Remove unused code and dependencies
- Check for circular dependencies

### 3.4 Test

**What to test:**

- Business logic and edge cases
- Error handling paths
- Public API contracts

**Test quality:**

- Independent and isolated
- Deterministic, no flaky tests
- Fast execution
- Test behavior, not implementation

---

## 4. Principles

### Core

| Principle | Meaning                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------- |
| SOLID     | Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion |
| DRY       | Extract duplication, but don't over-abstract                                                         |
| KISS      | Prefer clarity over cleverness                                                                       |
| YAGNI     | Don't build until needed                                                                             |

### Simple over Complex

| Avoid                              | Prefer               |
| ---------------------------------- | -------------------- |
| Abstract factories                 | Direct instantiation |
| Deep indirection                   | 1-2 layers max       |
| Generic solutions for one use case | Specific solutions   |
| Configuration everywhere           | Sensible defaults    |

### Code Smells

| Smell               | Fix                       |
| ------------------- | ------------------------- |
| God class           | Split by responsibility   |
| Feature envy        | Move method to data owner |
| Long parameter list | Use parameter object      |
| Primitive obsession | Create value objects      |
| Dead code           | Delete it                 |
