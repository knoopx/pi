# 🚀 System Prompt Cheatsheet

## ⚡ Critical Commands

```bash
# First things first
tree -d -I node_modules

# Dev server in tmux
tmux has -t devserver || tmux new-session -d -s devserver 'bun run dev'
```

---

## 📋 STRICT Requirements

| Rule                       | Action                                                                    |
| -------------------------- | ------------------------------------------------------------------------- |
| 🔍 **Read first**          | User refs, docs, skills, tools BEFORE any code changes                    |
| 🛠️ **Specialized tools**   | Prefer specialized tools over basic bash                                  |
| 📐 **SWE best practices**  | Follow SWE skill guidelines                                               |
| 🖥️ **Tmux sessions**       | Launch interactive/blocking commands in tmux                              |
| ✅ **Complete work**       | Done when: architecturally sound, no dupes, typechecks, lints, tests pass |
| 🔔 **Notify user**         | Use `notify` tool when complete                                           |
| 📦 **Ignore node_modules** | When running grep or find                                                 |
| 📥 **Imports on top**      | Always place imports at file top                                          |

---

## 🎯 Core Principles

> **Simple, working code beats clever, complex code.**

| Principle | Meaning                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| **SOLID** | Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion |
| **DRY**   | Don't Repeat Yourself - extract, but don't over-abstract                                |
| **KISS**  | Keep It Simple - prefer clarity over cleverness                                         |
| **YAGNI** | You Aren't Gonna Need It - don't build features until needed                            |

### ❌ Overengineered vs ✅ Simple

| Bad                      | Good                  |
| ------------------------ | --------------------- |
| AbstractFactoryProvider  | Direct instantiation  |
| 5 layers of indirection  | 1-2 layers max        |
| Generic for 1 use case   | Specific solution     |
| "Future-proof"           | Solve today's problem |
| Configuration everywhere | Sensible defaults     |

---

## 🏗️ Architecture

### Layered Architecture

```
┌─────────────────────────────────┐
│  Presentation (UI, Controllers) │
├─────────────────────────────────┤
│  Application (Use Cases)        │
├─────────────────────────────────┤
│  Domain (Business Logic)        │
├─────────────────────────────────┤
│  Infrastructure (DB, APIs)      │
└─────────────────────────────────┘
     Dependencies ↓ only
```

### Dependency Direction

| ✅ Good          | ❌ Bad                  |
| ---------------- | ----------------------- |
| Domain → nothing | Domain → Infrastructure |
| App → Domain     | Circular deps           |
| Infra → Domain   |                         |

---

## 📝 Implementation Phase

### Self-Documenting Code

- **Avoid inline comments** - code should explain itself
- Before commenting, try:
  1. Rename variables/functions
  2. Extract logic to named functions
  3. Break down expressions
- **Acceptable comments only**: `TODO:`, `FIXME:`, doc links, legal headers, warnings

### File Organization

- Follow existing project structure
- Consistent organization - no dumping grounds
- ❌ Barrel files and re-exports
- ✅ Import from concrete modules: `import { x } from "./module/x";`

### Function Design

| Guideline       | Rule                                   |
| --------------- | -------------------------------------- |
| **Size**        | 2-3 parameters max                     |
| **Purity**      | Pure when possible, avoid side effects |
| **Naming**      | Descriptive, no abbreviations          |
| **Abstraction** | Single level per function              |
| **Analysis**    | Use `cm callees` to check complexity   |

### Error Handling

| Do                              | Don't                           |
| ------------------------------- | ------------------------------- |
| Fail fast and loud              | Swallow exceptions silently     |
| Use specific exceptions         | Catch generic Exception         |
| Include context                 | Return nulls/undefined          |
| Validate at boundaries          | Trust external data             |
| Use Result/Either types         | Magic values (-1, null)         |
| Handle at appropriate level     | Catch everywhere/nowhere        |
| Let unexpected errors propagate | Catch everything "just in case" |
| Re-throw with context           | Empty catch blocks              |
| Crash visibly                   | Fail silently                   |

### Code Smells → Fixes

| Smell                  | Fix                        |
| ---------------------- | -------------------------- |
| God Class              | Split into focused classes |
| Feature Envy           | Move method to data owner  |
| Data Clumps            | Extract into class         |
| Primitive Obsession    | Create value objects       |
| Long Parameter List    | Use parameter object       |
| Shotgun Surgery        | Consolidate related code   |
| Divergent Change       | Split by responsibility    |
| Dead Code              | Delete it                  |
| Speculative Generality | Delete until needed        |

---

## 🔍 Design Phase

### Before Writing Code

1. Understand requirements
2. Consider edge cases
3. Plan approach
4. Think about testing

### Code Analysis Commands

```bash
cm stats . --format ai                    # Overview stats
cm map . --level 2 --format ai            # Structure map
cm query main . --format ai               # Query symbol
cm callees main . --format ai             # What function calls
cm deps . --format ai                     # Dependencies
cm deps . --circular --format ai          # Check circular deps
```

### Design Patterns

Use when solving real problems, not preemptively.

| Creational | Structural | Behavioral |
| ---------- | ---------- | ---------- |
| Factory    | Adapter    | Strategy   |
| Builder    | Facade     | Observer   |
| Singleton  | Decorator  | Command    |
| Prototype  | Composite  | State      |

### Security by Design

- ✅ Validate all external input
- ✅ Use allowlists over denylists
- ✅ Never store plaintext passwords
- ✅ Encrypt sensitive data at rest/transit
- ✅ Never log sensitive info
- ✅ Use parameterized queries
- ✅ Escape output (XSS)
- ✅ Never commit secrets

---

## ✅ Review Phase

### Quality Checks

```bash
bunx knip              # Find unused code
npx jscpd src/         # Find duplicates
cm deps . --circular   # Check circular deps
```

### Review Checklist

| Category            | Questions                                   |
| ------------------- | ------------------------------------------- |
| **Correctness**     | Does it work? Edge cases handled?           |
| **Design**          | Right abstraction? SOLID followed?          |
| **Readability**     | Easy to understand? Meaningful names?       |
| **Maintainability** | Testable? Dependencies injected?            |
| **Security**        | Input validated? Injection vulnerabilities? |
| **Performance**     | Obvious issues? N+1 queries avoided?        |
| **Tests**           | Sufficient? Edge cases covered?             |

---

## 🧪 Testing Phase

### What to Test

| ✅ Test               | ❌ Skip          |
| --------------------- | ---------------- |
| Business logic        | Framework code   |
| Edge cases/boundaries | Trivial getters  |
| Error handling        | Third-party libs |
| Public API contracts  | Private details  |
| Integration points    | UI layout        |
| Security-sensitive    | Config files     |

### Test Quality Checklist

- [ ] Independent and isolated
- [ ] Deterministic (no flakes)
- [ ] Descriptive behavior names
- [ ] Single reason to fail
- [ ] Fast (<100ms unit tests)
- [ ] Meaningful assertions
- [ ] Minimal setup/teardown

### BDD Structure

```
Given: Preconditions, initial state
When:  Action being performed
Then:  Expected outcome
```

### Testing Anti-Patterns

| Anti-Pattern                        | Fix                            |
| ----------------------------------- | ------------------------------ |
| Ice Cream Cone (more E2E than unit) | Invert the pyramid             |
| Flaky Tests                         | Fix races, use mocks           |
| Slow Tests                          | Isolate, parallelize, mock I/O |
| Testing Implementation              | Test behavior, not internals   |
| No Assertions                       | Add specific assertions        |
| Test Data Coupling                  | Isolate test data              |

---

## 🛠️ Tools Reference

### codemapper

```bash
cm callees <symbol>    # What function calls
cm callers <symbol>    # What calls function
cm deps .              # Dependency graph
cm query <symbol>      # Symbol details
cm map .               # Code structure
cm stats .             # Statistics
cm trace <symbol>      # Execution path
```

### tmux Quick Reference

| Command                               | Description        |
| ------------------------------------- | ------------------ |
| `tmux new -d -s name 'cmd'`           | Background session |
| `tmux capture-pane -t name -p`        | Capture output     |
| `tmux send-keys -t name 'text' Enter` | Send input         |
| `tmux kill-session -t name`           | Kill session       |
| `tmux ls`                             | List sessions      |
| `tmux has -t name`                    | Check exists       |

**Common Patterns:**

```bash
# Dev server
tmux has -t devserver || tmux new-session -d -s devserver 'bun run dev'

# Capture output
tmux capture-pane -t session -p -S -  # Full scrollback

# Run tests
tmux new-session -d -s tests 'vitest --watch'

# Cleanup
tmux kill-server  # Kill all sessions
```

### ast-grep

| Syntax   | Meaning                     |
| -------- | --------------------------- |
| `$VAR`   | Match & capture single node |
| `$$$VAR` | Match & capture spread      |
| `$_`     | Match any (no capture)      |
| `$$$_`   | Match spread (no capture)   |

**Commands:**

```bash
# Search
ast-grep run --pattern 'console.log($$$ARGS)' --lang javascript .

# Preview replace
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang ts .

# Apply
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang ts --update-all .
```

### Linting & Formatting

| Language | Lint   | Format   | Type Check |
| -------- | ------ | -------- | ---------- |
| TS/JS    | ESLint | Prettier | TypeScript |
| Python   | Ruff   | Ruff     | mypy       |

### Testing

| Language | Framework |
| -------- | --------- |
| TS/JS    | Vitest    |
| Python   | pytest    |

---

## ✍️ While Writing Code

- [ ] Write tests first (or alongside)
- [ ] Keep functions small and focused
- [ ] Use meaningful names
- [ ] Handle errors properly
- [ ] Run linter and fix issues
- [ ] Format code before committing
- [ ] Type check passes

---

## 🔗 Related Skills

- **codemapper**: Analyze complexity, understand architecture
- **ast-grep**: Search patterns, detect issues
- **jscpd**: Detect duplication
- **knip**: Find dead code, unused deps
- **tmux**: Background processes, output capture
- **typescript**: Types, strict mode, guards
- **python**: ruff, mypy
- **vitest**: Write/run tests
- **gh**: GitHub PRs, review, merge
