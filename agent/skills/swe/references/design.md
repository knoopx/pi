# Design Phase

Guidelines for requirements analysis, principles, architecture, and security by design.

---

## Requirements Analysis

### Before Writing Code

- [ ] Understand the requirements
- [ ] Consider edge cases
- [ ] Plan the approach
- [ ] Think about testing

### Tools for Understanding Existing Code

Before designing new features, understand the existing codebase:

```bash
# Get project overview with codemapper
cm stats . --format ai
cm map . --level 2 --format ai

# Find entry points and main flows
cm query main . --format ai
cm callees main . --format ai

# Understand module dependencies
cm deps . --format ai
cm deps . --circular --format ai  # Check for issues
```

---

## Core Principles

### SOLID Principles

| Principle | Description | Violation Sign |
|-----------|-------------|----------------|
| **S**ingle Responsibility | A class/module should have one reason to change | Class doing too many things |
| **O**pen/Closed | Open for extension, closed for modification | Modifying existing code for new features |
| **L**iskov Substitution | Subtypes must be substitutable for base types | Overridden methods breaking contracts |
| **I**nterface Segregation | Many specific interfaces > one general interface | Clients forced to depend on unused methods |
| **D**ependency Inversion | Depend on abstractions, not concretions | High-level modules importing low-level details |

### DRY, KISS, YAGNI

```
DRY   - Don't Repeat Yourself: Extract common logic, but don't over-abstract
KISS  - Keep It Simple, Stupid: Prefer clarity over cleverness
YAGNI - You Aren't Gonna Need It: Don't build features until needed
```

**Detect DRY violations with jscpd:**

```bash
# Find duplicate code blocks
npx jscpd /path/to/source
npx jscpd --pattern "src/**/*.ts"
```

### Simplicity Over Complexity

**Simple, working code beats clever, complex code.**

```
❌ OVERENGINEERED                    ✅ SIMPLE
─────────────────────────────────────────────────────
AbstractFactoryProvider              Direct instantiation
5 layers of indirection              1-2 layers max
Generic solution for 1 use case      Specific solution that works
"Future-proof" architecture          Solve today's problem
Premature optimization               Optimize when needed
Configuration for everything         Sensible defaults
```

**Signs of overengineering:**
- Adding abstractions "just in case"
- Building frameworks instead of features
- More interfaces than implementations
- Config files larger than code
- Can't explain the architecture simply

**Keep it simple:**
- Write the simplest code that works
- Add complexity only when required
- Prefer explicit over implicit
- Inline code until you need to reuse it
- Delete code you don't need

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
}                                    // Compose in caller:
                                     validateUser(user);
                                     saveUser(user);
                                     sendWelcomeEmail(user);
```

**Apply at every level:**
- **Functions**: Do one operation
- **Classes**: Handle one concept
- **Modules**: Own one domain
- **Files**: Contain related code only

**Analyze responsibilities with codemapper:**

```bash
# See what a function does (check for multiple responsibilities)
cm callees processUser . --format ai

# Find who depends on it
cm callers processUser . --format ai
```

### The Rule of Three

Duplicate code twice before extracting. Premature abstraction is worse than duplication.

**Use jscpd to track when extraction is needed:**

```bash
# Find blocks duplicated 3+ times
npx jscpd --min-tokens 50 --min-lines 5 src/
```

### Avoid Legacy Code and Backwards Compatibility

**Don't introduce backwards compatibility unless explicitly requested.**

```
❌ DON'T                             ✅ DO
─────────────────────────────────────────────────────
@deprecated annotations              Remove old code
Legacy adapters "just in case"       Use current APIs only
Supporting old + new patterns        One pattern, the new one
Migration layers                     Direct implementation
Fallback behaviors                   Fail fast if incompatible
```

**Rules:**
- Delete deprecated code, don't mark it
- Don't write shims or polyfills unless asked
- Don't maintain multiple code paths for old/new
- Don't add version checks or feature detection unnecessarily
- If refactoring, replace entirely - don't add parallel implementations

**Find dead code with knip:**

```bash
# Find unused files, exports, and dependencies
bunx knip
bunx knip --include files      # Unused files only
bunx knip --include exports    # Unused exports only
```

### Feature Flags Are a Code Smell

**Conditional logic based on flags/modes creates maintenance nightmares.**

```typescript
// ❌ FEATURE FLAGS: Hidden complexity, untested paths
if (featureFlags.newCheckout) {
  await newCheckoutFlow(cart);
} else {
  await legacyCheckoutFlow(cart);
}

// ✅ SIMPLE: One code path, always
await checkoutFlow(cart);

// ✅ DEPENDENCY INJECTION: Swap implementations cleanly
function createUserService(emailSender: EmailSender) {
  // One code path, different injected dependencies
}
```

**Why flags are harmful:**
- Double the code paths, double the bugs
- Rarely tested in all combinations
- "Temporary" flags become permanent
- Hard to reason about system state
- Dead code accumulates behind old flags

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
UI → Application                     Everything → Everything
```

**Validate dependency direction with codemapper:**

```bash
# Check for circular dependencies
cm deps . --circular --format ai

# Analyze module coupling
cm deps ./src/domain --direction used-by --format ai

# Ensure domain doesn't depend on infrastructure
cm deps ./src/domain --format ai
```

### Module Boundaries

- High cohesion within modules
- Low coupling between modules
- Clear public interfaces
- Hide implementation details
- Communicate through well-defined contracts

**Inspect module structure:**

```bash
# View public API
cm map ./src/module --level 2 --exports-only --format ai

# Check what depends on this module
cm deps ./src/module --direction used-by --format ai
```

### Design Patterns

Use patterns when they solve a real problem, not preemptively.

#### Creational Patterns

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| **Factory** | Object creation is complex or conditional | Simple constructor suffices |
| **Builder** | Many optional parameters | Few, required parameters |
| **Singleton** | Exactly one instance needed (config, logging) | Dependency injection available |
| **Prototype** | Cloning is cheaper than creation | Objects are simple to create |

#### Structural Patterns

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| **Adapter** | Integrating incompatible interfaces | Can modify original code |
| **Facade** | Simplifying complex subsystem | Subsystem is already simple |
| **Decorator** | Adding behavior dynamically | Inheritance is clearer |
| **Composite** | Tree structures (UI, files) | Flat structures |

#### Behavioral Patterns

| Pattern | Use When | Avoid When |
|---------|----------|------------|
| **Strategy** | Multiple algorithms, runtime selection | Single algorithm |
| **Observer** | Many dependents need notification | Simple callbacks suffice |
| **Command** | Undo/redo, queuing, logging operations | Direct calls are sufficient |
| **State** | Object behavior varies by state | Few, simple states |

**Find pattern implementations:**

```bash
# Search for factory patterns
ast-grep run --pattern 'function create$NAME($$$ARGS) { $$$BODY }' --lang typescript .

# Find singleton patterns
ast-grep run --pattern 'static getInstance() { $$$BODY }' --lang typescript .
```

---

## Security by Design

### Input Validation

- Validate all external input
- Use allowlists over denylists
- Sanitize before use
- Validate on server side (never trust client)

### Authentication & Authorization

- Use established libraries
- Never store plaintext passwords
- Implement proper session management
- Follow principle of least privilege

### Data Protection

- Encrypt sensitive data at rest and in transit
- Never log sensitive information
- Use parameterized queries (prevent SQL injection)
- Escape output (prevent XSS)

### Secrets Management

- Never commit secrets to version control
- Use environment variables or secret managers
- Rotate secrets regularly
- Audit secret access

**Search for security issues with ast-grep:**

```bash
# Find hardcoded secrets (basic patterns)
ast-grep run --pattern 'password = "$_"' --lang typescript .
ast-grep run --pattern 'api_key = "$_"' --lang python .

# Find console.log of potentially sensitive data
ast-grep run --pattern 'console.log($$$ARGS)' --lang typescript .

# Find SQL string concatenation (potential injection)
ast-grep run --pattern '"SELECT $$$" + $_' --lang typescript .
```

---

## Related Skills

- **codemapper**: Use `cm map`, `cm deps`, `cm callers` for understanding architecture
- **ast-grep**: Search for patterns indicating design issues
- **jscpd**: Detect code duplication violating DRY
- **knip**: Find dead code and unused dependencies
