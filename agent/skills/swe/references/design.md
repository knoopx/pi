# Design Reference

Extended guidelines for architecture, patterns, and advanced design topics.
For core principles (SOLID, DRY, KISS, YAGNI), see the **design** skill.

---

## Advanced Principles

### Single Responsibility

**Each function/class/module should do ONE thing well.**

```
❌ MULTIPLE RESPONSIBILITIES         ✅ SINGLE RESPONSIBILITY
─────────────────────────────────────────────────────
function processUser(user) {         function validateUser(user) { }
  validate(user);                    function saveUser(user) { }
  save(user);                        function sendWelcomeEmail(user) { }
  sendEmail(user);                   function logUserCreation(user) { }
  logActivity(user);
}                                    // Compose in caller
```

**Apply at every level:**

- **Functions**: Do one operation
- **Classes**: Handle one concept
- **Modules**: Own one domain

**Analyze responsibilities with codemapper:**

```bash
cm callees processUser . --format ai  # What does it do?
cm callers processUser . --format ai  # Who depends on it?
```

### The Rule of Three

Duplicate code twice before extracting. Premature abstraction is worse than duplication.

```bash
# Find blocks duplicated 3+ times
npx jscpd --min-tokens 50 --min-lines 5 src/
```

### Avoid Backwards Compatibility

**Don't introduce backwards compatibility unless explicitly requested.**

- Delete deprecated code, don't mark it
- Don't write shims or polyfills unless asked
- Don't maintain multiple code paths for old/new
- If refactoring, replace entirely

```bash
# Find dead code with knip
bunx knip
bunx knip --include files
bunx knip --include exports
```

### Feature Flags Are a Code Smell

```typescript
// ❌ FEATURE FLAGS: Hidden complexity
if (featureFlags.newCheckout) {
  await newCheckoutFlow(cart);
} else {
  await legacyCheckoutFlow(cart);
}

// ✅ SIMPLE: One code path
await checkoutFlow(cart);
```

---

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│         Presentation Layer                          │  UI, API Controllers
├─────────────────────────────────────────────────────┤
│         Application Layer                           │  Use Cases, Orchestration
├─────────────────────────────────────────────────────┤
│           Domain Layer                              │  Business Logic, Entities
├─────────────────────────────────────────────────────┤
│        Infrastructure Layer                         │  Database, External Services
└─────────────────────────────────────────────────────┘

Rule: Dependencies point downward only
```

### Dependency Direction

```
✅ GOOD                              ❌ BAD
─────────────────────────────────────────────────────
Domain → nothing                     Domain → Infrastructure
Application → Domain                 UI → Database directly
Infrastructure → Domain              Circular dependencies
```

```bash
# Check for circular dependencies
cm deps . --circular --format ai

# Ensure domain doesn't depend on infrastructure
cm deps ./src/domain --format ai
```

### Design Patterns

Use patterns when they solve a real problem, not preemptively.

| Category   | Pattern  | Use When                               |
| ---------- | -------- | -------------------------------------- |
| Creational | Factory  | Object creation is complex             |
| Creational | Builder  | Many optional parameters               |
| Structural | Adapter  | Integrating incompatible interfaces    |
| Structural | Facade   | Simplifying complex subsystem          |
| Behavioral | Strategy | Multiple algorithms, runtime selection |
| Behavioral | Observer | Many dependents need notification      |

---

## Security Patterns

### Input Validation

- Validate all external input
- Use allowlists over denylists
- Validate on server side

### Data Protection

- Encrypt sensitive data at rest and in transit
- Never log sensitive information
- Use parameterized queries (prevent SQL injection)
- Escape output (prevent XSS)

```bash
# Find hardcoded secrets
ast-grep run --pattern 'password = "$_"' --lang typescript .

# Find console.log of potentially sensitive data
ast-grep run --pattern 'console.log($$$ARGS)' --lang typescript .
```

---

## Related Skills

- **design**: Core principles (SOLID, DRY, KISS, YAGNI)
- **codemapper**: Architecture analysis
- **jscpd**: Detect code duplication
- **knip**: Find dead code
