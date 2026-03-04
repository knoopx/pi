---
name: swe
description: Applies software engineering best practices, design principles, and avoids common anti-patterns. Use when designing systems, reviewing code quality, refactoring legacy code, making architectural decisions, or improving maintainability.
---

# Software Engineering

## Core Principles

| Principle             | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| Simplicity            | Simplest code that works; complexity only when required |
| Single Responsibility | Each function/class/module does one thing               |
| Self-Documenting      | Code explains itself; comments are a smell              |
| Fail Fast             | Validate early, propagate unexpected errors             |
| Test Behavior         | What code does, not implementation                      |
| No Backwards Compat   | Don't add legacy support unless requested               |
| Consistency           | Match project conventions over preference               |

---

## Design

### SOLID

| Principle                 | Violation Sign                           |
| ------------------------- | ---------------------------------------- |
| **S**ingle Responsibility | Class doing too many things              |
| **O**pen/Closed           | Modifying existing code for new features |
| **L**iskov Substitution   | Overridden methods breaking contracts    |
| **I**nterface Segregation | Clients depend on unused methods         |
| **D**ependency Inversion  | High-level imports low-level details     |

### Architecture

```
Presentation → Application → Domain ← Infrastructure
                    ↓
           Dependencies point DOWN only
```

**Rules:**

- Domain depends on nothing
- Infrastructure implements domain interfaces
- No circular dependencies

### Design Patterns

Use when solving real problems, not preemptively:

| Pattern  | Use When                          |
| -------- | --------------------------------- |
| Factory  | Complex object creation           |
| Builder  | Many optional parameters          |
| Adapter  | Incompatible interfaces           |
| Facade   | Simplifying subsystem             |
| Strategy | Runtime algorithm selection       |
| Observer | Many dependents need notification |

### Security

- Validate all external input (allowlists > denylists)
- Encrypt sensitive data at rest and transit
- Never log secrets
- Parameterized queries (SQL injection)
- Escape output (XSS)

---

## Implementation

### Naming

| Type      | Convention              | Example                     |
| --------- | ----------------------- | --------------------------- |
| Variables | camelCase noun          | `userName`, `isValid`       |
| Functions | camelCase verb          | `getUser`, `validateInput`  |
| Booleans  | `is`/`has`/`can` prefix | `isActive`, `hasPermission` |
| Constants | UPPER_SNAKE             | `MAX_RETRIES`               |
| Classes   | PascalCase noun         | `UserService`               |

**Rules:**

- Names reveal intent
- No single-letter params
- No abbreviations (`ur` → `userRepository`)

### Self-Documenting Code

```typescript
// ❌ Comment hiding bad code
if (u.r === 1 && u.s !== 0) { ... }

// ✅ Self-documenting
if (user.isAdmin && user.isActive) { ... }
```

**Acceptable comments:** RFC links, bug tracker refs, non-obvious warnings

### Functions

| Do                       | Don't                      |
| ------------------------ | -------------------------- |
| Small, focused           | God functions (100+ lines) |
| 2-3 params max           | 6+ parameters              |
| Return early             | Deep nesting               |
| Pure when possible       | Hidden side effects        |
| Single abstraction level | Mixed levels               |

### Error Handling

```typescript
// ❌ Silent catch
try {
  await save(user);
} catch (e) {}

// ❌ Log only
try {
  await save(user);
} catch (e) {
  console.log(e);
}

// ✅ Let propagate or handle specific
try {
  await save(user);
} catch (e) {
  if (e instanceof DuplicateEmail) return { error: "Email taken" };
  throw e;
}
```

**Rules:**

- Empty catch = always wrong
- Catch only what you can handle
- Re-throw with context or propagate
- Crash visibly > fail silently

### File Organization

- Match existing conventions
- No barrel files (`index.ts` re-exports)
- Import from concrete modules
- Co-locate tests with source

```
src/users/
  user-service.ts
  user-service.test.ts
```

### Code Smells

| Smell               | Fix                       |
| ------------------- | ------------------------- |
| God Class           | Split by responsibility   |
| Feature Envy        | Move method to data owner |
| Long Param List     | Parameter object          |
| Primitive Obsession | Value objects             |
| Dead Code           | Delete it                 |

### Linting

| Tool         | Purpose                  |
| ------------ | ------------------------ |
| Formatter    | Style (Prettier, dprint) |
| Linter       | Quality (ESLint, Ruff)   |
| Type Checker | Safety (tsc, mypy)       |

**Rules:**

- Automate formatting
- Zero warnings in CI
- Never disable rules—fix the code

---

## Testing

### Test Pyramid

```
    E2E (few) - Critical journeys, slow
   Integration (some) - Component interactions
  Unit (many) - Fast, isolated, business logic
```

### What to Test

| Test           | Skip              |
| -------------- | ----------------- |
| Business logic | Framework code    |
| Edge cases     | Trivial getters   |
| Error paths    | Third-party libs  |
| Public API     | Private internals |

### Test Quality

- Independent and isolated
- Deterministic (no flakiness)
- Fast (< 100ms unit)
- Single reason to fail
- Test behavior, not implementation

### BDD Structure

```typescript
describe("UserService", () => {
  describe("given valid data", () => {
    describe("when creating user", () => {
      it("then persists with ID", async () => {
        // arrange, act, assert
      });
    });
  });
});
```

### Anti-Patterns

| Pattern                | Fix                   |
| ---------------------- | --------------------- |
| Ice Cream Cone         | More unit, fewer E2E  |
| Flaky Tests            | Fix races, use mocks  |
| Testing Implementation | Test behavior         |
| No Assertions          | Add meaningful checks |

---

## Review

### Before PR

- [ ] Type check passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] No debug/console.log
- [ ] No commented code
- [ ] Up to date with main

### Review Checklist

**Correctness:**

- Does it work? Edge cases? Error handling?

**Design:**

- Right abstraction? SOLID? Dependencies appropriate?

**Readability:**

- Clear names? Straightforward logic? No unnecessary comments?

**Security:**

- Input validated? No injection? Secrets handled?

**Performance:**

- No N+1? No await in loops? Caching considered?

**Tests:**

- Sufficient coverage? Edge cases? Behavior-focused?

### For Reviewers

- Code, not author
- Questions > demands
- Explain the "why"
- Blocking vs nitpick

### For Authors

- Small, focused PRs
- Context in description
- Respond to all comments

---

## Maintenance

### Refactoring

1. Ensure test coverage first
2. Small, incremental changes
3. Run tests after each change
4. Refactor OR add features, never both

| Technique              | When                         |
| ---------------------- | ---------------------------- |
| Extract Method         | Long method, reusable logic  |
| Extract Class          | Multiple responsibilities    |
| Move Method            | Uses other class's data more |
| Introduce Param Object | Long parameter lists         |

### Technical Debt

| Type          | Handling                   |
| ------------- | -------------------------- |
| Deliberate    | Document, schedule payback |
| Accidental    | Fix when discovered        |
| Bit Rot       | Regular maintenance        |
| Outdated Deps | Regular updates            |

**Find:** unused code, duplicates, circular deps, outdated deps

### Performance

1. Don't optimize prematurely
2. Measure before optimizing
3. Focus on hot paths

| Pitfall      | Fix                |
| ------------ | ------------------ |
| N+1 queries  | Batch, joins       |
| Blocking I/O | Async              |
| Memory leaks | Weak refs, cleanup |

### Documentation

| Document             | Skip                   |
| -------------------- | ---------------------- |
| Public APIs          | Obvious code           |
| ADRs                 | Implementation details |
| Setup/deploy         | Self-documenting code  |
| Non-obvious behavior | Every function         |

---

## Anti-Patterns

| Pattern          | Problem           | Fix               |
| ---------------- | ----------------- | ----------------- |
| Big Ball of Mud  | No structure      | Define boundaries |
| Spaghetti Code   | Tangled           | Modularize        |
| Lava Flow        | Dead code         | Delete it         |
| Copy-Paste       | Duplication       | Extract           |
| Magic Numbers    | No context        | Named constants   |
| Circular Deps    | Coupling          | Abstraction layer |
| Feature Flags    | Hidden complexity | One code path     |
| Backwards Compat | Legacy burden     | Replace entirely  |

---

## AI-Generated Debt

Code written by LLMs (including by this agent) accumulates specific debt patterns. Detect and fix on sight.

| Pattern                   | Description                                                  |
| ------------------------- | ------------------------------------------------------------ |
| Restating comments        | Comment says what the next line does in different words      |
| Boilerplate sprawl        | Verbose wrappers, re-exports, adapters that add no value     |
| Premature abstraction     | Generic solution for a single use case                       |
| Convention drift          | Each file follows a slightly different style                 |
| Cargo-cult error handling | try/catch everywhere with no actual recovery strategy        |
| Orphan interfaces         | Interface defined but only one implementor, no extension     |
| Placeholder logic         | TODO/stub/mock left behind, never replaced                   |
| Over-typing               | Complex generics when a concrete type is clearer             |
| Hallucinated API usage    | Calling methods/options that don't exist in the actual lib   |
| Copy-paste signatures     | Same function shape repeated across files with minor changes |

---

## Code Health Dimensions

When reviewing or writing code, assess across two axes.

### Mechanical (verifiable by tools)

| Dimension   | What to check                                       |
| ----------- | --------------------------------------------------- |
| Dead code   | Unused imports, exports, variables, functions       |
| Duplication | Near-identical blocks across files                  |
| Complexity  | Deep nesting, long functions, high cyclomatic count |
| Dependency  | Import cycles, orphaned files, coupling violations  |
| Test health | Critical paths without tests, flaky tests           |
| Security    | Unsanitized input, hardcoded secrets, SQL injection |

### Subjective (requires judgment)

| Dimension              | What to check                                                   |
| ---------------------- | --------------------------------------------------------------- |
| Naming quality         | Do names communicate intent without reading the implementation? |
| Logic clarity          | Can you follow control flow without mental stack overflow?      |
| Error consistency      | Same error strategy across modules, or a mix of patterns?       |
| Abstraction fitness    | Does each abstraction earn its cost with real leverage?         |
| Contract coherence     | Do functions honor their stated interfaces?                     |
| Cross-module arch      | Dependency direction correct? Hub modules justified?            |
| Convention consistency | Same patterns in sibling files? Or style islands?               |

### Prioritizing Fixes

| Tier | Effort         | Examples                                  |
| ---- | -------------- | ----------------------------------------- |
| T1   | Auto-fixable   | Unused imports, debug logs, formatting    |
| T2   | Quick manual   | Unused vars, dead exports, simple rename  |
| T3   | Needs judgment | Near-duplicates, questionable abstraction |
| T4   | Major refactor | God class split, mixed-concern untangle   |

Fix T1/T2 immediately. T3/T4 require a plan.

### Acknowledging vs Hiding Debt

When leaving an issue unfixed:

- **Document the decision** - why it stays, not just that it does
- **Track the cost** - wontfix debt is still debt, it just has a reason
- **Revisit periodically** - reasons expire; what was acceptable 6 months ago may not be now
- **Never dismiss to improve metrics** - if the code is worse, admit it
