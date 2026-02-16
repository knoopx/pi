---
name: swe
description: Applies software engineering best practices, design principles, and avoids common anti-patterns. Use when designing systems, reviewing code quality, refactoring legacy code, making architectural decisions, or improving maintainability.
---

# Software Engineering Best Practices

A comprehensive guide to writing maintainable, scalable, and high-quality software, organized by development phase.

## Key Principles Summary

- **Simplicity wins**: Write the simplest code that works; add complexity only when required
- **Single responsibility**: Each function/class/module should do one thing well
- **Self-documenting code**: Code should explain itself; comments are a code smell
- **Fail fast**: Validate inputs early, let unexpected errors propagate
- **Test behavior**: Focus on what code does, not implementation details
- **No backwards compatibility**: Don't add legacy support unless explicitly requested
- **Consistency**: Match existing project conventions over personal preference

---

## Phase 1: Design

Extended guidelines for architecture, patterns, and advanced design topics.

### Advanced Principles

#### Single Responsibility

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

**Analyze responsibilities:**

- Find callees of a function to see what it does
- Find callers of a function to see who depends on it

#### The Rule of Three

Duplicate code twice before extracting. Premature abstraction is worse than duplication.

- Use duplication detection to find blocks duplicated 3+ times

#### Avoid Backwards Compatibility

**Don't introduce backwards compatibility unless explicitly requested.**

- Delete deprecated code, don't mark it
- Don't write shims or polyfills unless asked
- Don't maintain multiple code paths for old/new
- If refactoring, replace entirely

**Find dead code** - unused files, exports, and dependencies that can be safely deleted.

#### Feature Flags Are a Code Smell

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

### Architecture

#### Layered Architecture

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

#### Dependency Direction

```
✅ GOOD                              ❌ BAD
─────────────────────────────────────────────────────
Domain → nothing                     Domain → Infrastructure
Application → Domain                 UI → Database directly
Infrastructure → Domain              Circular dependencies
```

**Analyze dependencies:**

- Check for circular dependencies between modules
- Ensure domain doesn't depend on infrastructure

#### Design Patterns

Use patterns when they solve a real problem, not preemptively.

| Category   | Pattern  | Use When                               |
| ---------- | -------- | -------------------------------------- |
| Creational | Factory  | Object creation is complex             |
| Creational | Builder  | Many optional parameters               |
| Structural | Adapter  | Integrating incompatible interfaces    |
| Structural | Facade   | Simplifying complex subsystem          |
| Behavioral | Strategy | Multiple algorithms, runtime selection |
| Behavioral | Observer | Many dependents need notification      |

### Security Patterns

#### Input Validation

- Validate all external input
- Use allowlists over denylists
- Validate on server side

#### Data Protection

- Encrypt sensitive data at rest and in transit
- Never log sensitive information
- Use parameterized queries (prevent SQL injection)
- Escape output (prevent XSS)

**Search for security issues:**

- Find hardcoded secrets (password assignments, API keys)
- Find logging of potentially sensitive data

---

## Phase 2: Implementation

Guidelines for self-documenting code, naming, functions, error handling, and avoiding code smells.

### Self-Documenting Code

**Write code that explains itself. Avoid inline comments.**

Comments are a code smell - they indicate the code isn't clear enough. Instead of adding comments, improve the code:

```
❌ BAD: Comment explaining unclear code
// Check if user can access the resource
if (u.r === 1 && u.s !== 0 && checkTs(u.t)) { ... }

✅ GOOD: Self-documenting code needs no comment
if (user.isAdmin && user.isActive && !user.isSessionExpired()) { ... }
```

When you feel the need to write a comment, first try to:

1. Rename variables/functions to be more descriptive
2. Extract complex logic into well-named functions
3. Break down long expressions into meaningful intermediates

**Only acceptable comments:**

- Links to external documentation (bug trackers, RFCs, specs)
- Legal/license headers
- Warnings about non-obvious side effects or gotchas

```
❌ INLINE COMMENTS (Don't write these)
─────────────────────────────────────────────────────
// Increment i
// Loop through array
// Set x to 5
// This function does stuff
// Added by John on 2024-01-15
// Get the user
// Check if valid
// Return the result
// TODO: Fix this later (track in issue tracker instead)
// FIXME: This is broken (fix it now or create an issue)

✅ ACCEPTABLE COMMENTS (Rare exceptions)
─────────────────────────────────────────────────────
// See RFC 7231 Section 6.5.4 for status code semantics
// Workaround for browser bug https://bugs.webkit.org/12345
// WARNING: This mutates the input array for performance
```

### Naming Conventions

**Be explicit, clear, and concise. Names should reveal intent.**

```
✅ GOOD                              ❌ BAD
─────────────────────────────────────────────────────
getUserById(userId)                  get(id)
isValidEmail(email)                  check(email)
calculateTotalPrice(items)           calc(items)
MAX_RETRY_ATTEMPTS                   MAX
userRepository                       ur
fetchUserData()                      getData()
hasPermission(user, action)          perm(u, a)
activeUsers                          list
emailAddress                         str
retryCount                           n
isEnabled                            flag
createdAt                            date
```

#### Avoid Ambiguous Parameters

**Never use single-letter or unclear parameter names.**

```
❌ BAD: Ambiguous parameters
function process(x) { ... }
function calc(a, b, c) { ... }
const result = items.map(x => x.value);

✅ GOOD: Clear, descriptive parameters
function processOrder(order) { ... }
function calculateDiscount(price, quantity, discountRate) { ... }
const values = items.map(item => item.value);
```

#### Naming Guidelines by Type

| Type                | Convention                              | Examples                                     |
| ------------------- | --------------------------------------- | -------------------------------------------- |
| **Variables**       | camelCase, noun/noun phrase             | `userName`, `activeCount`, `isValid`         |
| **Functions**       | camelCase, verb/verb phrase             | `getUser`, `calculateTotal`, `validateInput` |
| **Booleans**        | Prefix: `is`, `has`, `can`, `should`    | `isActive`, `hasPermission`, `canEdit`       |
| **Constants**       | UPPER_SNAKE_CASE                        | `MAX_RETRIES`, `API_BASE_URL`                |
| **Classes**         | PascalCase, noun                        | `UserService`, `OrderRepository`             |
| **Interfaces**      | PascalCase, noun/adjective              | `Serializable`, `UserConfig`                 |
| **Enums**           | PascalCase (name), UPPER_SNAKE (values) | `Status.PENDING`, `Role.ADMIN`               |
| **Private members** | Prefix `_` or `#`                       | `_cache`, `#internalState`                   |

**Review naming consistency:**

- List all symbols to review naming patterns
- Query specific symbol names to check consistency

### File Organization

#### File Naming Conventions

**Follow existing project structure. Be consistent.**

```
✅ CONSISTENT FILE NAMING
─────────────────────────────────────────────────────
kebab-case (recommended for most projects):
  user-service.ts
  order-repository.ts
  api-client.test.ts

PascalCase (React components, classes):
  UserProfile.tsx
  OrderList.tsx

snake_case (Python, Ruby):
  user_service.py
  order_repository.py

ALWAYS match existing project conventions!
```

#### Directory Structure

```
✅ GOOD STRUCTURE                    ❌ BAD STRUCTURE
─────────────────────────────────────────────────────
src/                                 src/
  users/                               utils.ts (god file)
    user-service.ts                    helpers.ts (vague)
    user-repository.ts                 misc.ts (dumping ground)
    user.types.ts                      stuff.ts (meaningless)
    user-service.test.ts               file1.ts (lazy naming)
  orders/
    order-service.ts
    order-repository.ts
```

#### Follow Existing Code Structure

**Consistency trumps personal preference.**

Before writing new code:

1. **Study existing patterns** - How are similar files structured?
2. **Match naming style** - Use same conventions as surrounding code
3. **Follow established architecture** - Don't introduce new patterns arbitrarily
4. **Respect module boundaries** - Place code where similar code lives

```
❌ DON'T: Introduce inconsistent patterns
// Existing: userService.getById(id)
// New code: fetchSingleOrder(orderId)  // Different naming style!

✅ DO: Match existing conventions
// Existing: userService.getById(id)
// New code: orderService.getById(orderId)  // Consistent!
```

#### Avoid Barrel Files and Re-exports

**Barrel files (`index.ts` re-exporting siblings) are an anti-pattern.** They hide dependencies, create circular import risks, and force wide rebuilds when unrelated exports change.

```
❌ BAD: Barrel file
// src/users/index.ts
export * from "./user-service";
export * from "./user-repository";

// usage
import { userService } from "./users";

✅ GOOD: Direct imports
import { userService } from "./users/user-service";
import { userRepository } from "./users/user-repository";
```

**Rules:**

- Import from the concrete module, not `index.ts`
- Don't add re-export layers unless a framework explicitly requires it
- Prefer explicit dependencies over convenience

**Analyze existing patterns:**

- Map project structure to understand organization
- Inspect existing services to see how they're structured
- Query symbol names to check naming conventions

### Function Design

```
✅ BEST PRACTICES                    ❌ ANTI-PATTERNS
─────────────────────────────────────────────────────
Small, focused functions             God functions (100+ lines)
2-3 parameters max                   6+ parameters
Return early for edge cases          Deep nesting
Pure functions when possible         Hidden side effects
Descriptive names                    Abbreviations
Single level of abstraction          Mixed abstraction levels
```

**Analyze function complexity:**

- Find callees of a function (too many = does too much)
- View function body to assess complexity

### Error Handling

#### Best Practices

```
✅ DO                                ❌ DON'T
─────────────────────────────────────────────────────
Fail fast and loud                   Swallow exceptions silently
Use specific exception types         Catch generic Exception
Include context in error messages    Return null for errors
Validate inputs at boundaries        Trust external data
Log errors with stack traces         Log without context
Use Result/Either types              Return magic values (-1, null)
Handle errors at appropriate level   Handle everywhere or nowhere
Let unexpected errors propagate      Catch everything "just in case"
```

#### Never Silence Exceptions

**Don't catch exceptions unless you can handle them meaningfully.**

```typescript
// ❌ NEVER: Silent catch
try {
  await saveUser(user);
} catch (error) {
  // silently ignored
}

// ❌ NEVER: Catch and log only (still loses the error)
try {
  await saveUser(user);
} catch (error) {
  console.log(error);
}

// ✅ GOOD: Let it propagate (caller handles or app crashes visibly)
await saveUser(user);

// ✅ GOOD: Handle specific errors you can recover from
try {
  await saveUser(user);
} catch (error) {
  if (error instanceof DuplicateEmailError) {
    return { error: "Email already registered" };
  }
  throw error; // Re-throw unexpected errors
}

// ✅ GOOD: Add context and re-throw
try {
  await saveUser(user);
} catch (error) {
  throw new UserServiceError(`Failed to save user ${user.id}`, {
    cause: error,
  });
}
```

**Find problematic error handling:**

- Search for empty catch blocks
- Search for catch blocks that only log
- Search for bare except clauses (Python)

**Rules:**

- Empty catch blocks are always wrong
- Catch only exceptions you can meaningfully handle
- Re-throw or propagate everything else
- If you catch, either recover or add context and re-throw
- Prefer crashing visibly over failing silently

#### Error Handling Patterns

```typescript
// ✅ Result type pattern
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function parseConfig(path: string): Result<Config> {
  try {
    const data = readFile(path);
    return { ok: true, value: JSON.parse(data) };
  } catch (error) {
    return { ok: false, error: new ConfigError(`Invalid config: ${path}`) };
  }
}

// ✅ Early return pattern
function processUser(user: User | null): string {
  if (!user) return "No user";
  if (!user.isActive) return "User inactive";
  if (!user.hasPermission) return "No permission";

  return performAction(user); // Happy path
}
```

### Code Smells

| Smell                      | Description                          | Refactoring                | Detection                   |
| -------------------------- | ------------------------------------ | -------------------------- | --------------------------- |
| **God Class**              | Class knows/does too much            | Split into focused classes | Find callees, inspect class |
| **Feature Envy**           | Method uses other class's data more  | Move method to that class  | Analyze dependencies        |
| **Data Clumps**            | Same data groups appear together     | Extract into a class       | Find duplicate code         |
| **Primitive Obsession**    | Using primitives for domain concepts | Create value objects       | Search code patterns        |
| **Long Parameter List**    | Functions with 5+ parameters         | Use parameter object       | Search code patterns        |
| **Shotgun Surgery**        | One change affects many classes      | Consolidate related code   | Find callers                |
| **Divergent Change**       | One class changed for many reasons   | Split by responsibility    | Inspect class               |
| **Dead Code**              | Unused code left in codebase         | Delete it                  | Find unused code            |
| **Speculative Generality** | Code for hypothetical futures        | Delete until needed        | Find unused code            |

**Detect code smells:**

- Find unused code (dead code)
- Find duplicate code (Data Clumps pattern)
- Find callees of suspected god functions (too many = does too much)
- Search for functions with 5+ parameters (long parameter lists)
- Find unused exports

### Linting & Code Formatting

**Automate style enforcement. Don't argue about formatting in code reviews.**

#### Principles

| Principle                 | Why                                          |
| ------------------------- | -------------------------------------------- |
| **Automate formatting**   | Eliminates bikeshedding, ensures consistency |
| **Use recommended rules** | Battle-tested defaults, less configuration   |
| **Lint on save/commit**   | Catch issues early, before PR                |
| **Zero warnings policy**  | Treat warnings as errors in CI               |
| **Format on save**        | Never commit unformatted code                |

#### Separation of Concerns

| Tool             | Purpose                            | Examples                             |
| ---------------- | ---------------------------------- | ------------------------------------ |
| **Formatter**    | Code style (spacing, quotes, etc.) | Prettier, dprint, Biome, ruff format |
| **Linter**       | Code quality (bugs, patterns)      | ESLint, Biome, Ruff, Pylint          |
| **Type checker** | Type safety                        | TypeScript, mypy, Pyright            |

**Don't overlap responsibilities.** Use a formatter for formatting, a linter for logic issues. Disable linter formatting rules when using a formatter.

#### When to Disable Rules

**Almost never.** If a rule flags your code, fix the code - don't disable the rule.

```typescript
// ❌ NEVER: Disable type safety - write proper types instead
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const response: any = await legacyApi.fetch();

// ✅ CORRECT: Write types for untyped APIs
interface LegacyResponse {
  data: unknown;
  status: number;
}
const response: LegacyResponse = await legacyApi.fetch();
```

**If you think you need to disable a rule:**

1. You're wrong - fix the code instead
2. Recommended rules exist for good reasons - follow them
3. If you can't satisfy a rule, your design is flawed - refactor

### While Writing Code Checklist

- [ ] Write tests first (or alongside)
- [ ] Keep functions small and focused
- [ ] Use meaningful names
- [ ] Handle errors properly
- [ ] Run linter and fix issues
- [ ] Format code before committing
- [ ] Type check passes

---

## Phase 3: Testing

Guidelines for test pyramid, BDD, test quality, and avoiding test anti-patterns.

### Test Pyramid

```
        /\
       /  \     E2E Tests (few)
      /----\    - Critical user journeys
     /      \   - Slow, expensive
    /--------\
   /          \ Integration Tests (some)
  /------------\- Component interactions
 /              \- Database, APIs
/----------------\
   Unit Tests (many)
   - Fast, isolated
   - Business logic
```

### What to Test

```
✅ TEST                              ❌ SKIP
─────────────────────────────────────────────────────
Business logic                       Framework code
Edge cases and boundaries            Trivial getters/setters
Error handling paths                 Third-party libraries
Public API contracts                 Private implementation details
Integration points                   UI layout (use visual tests)
Security-sensitive code              Configuration files
```

### Test Quality Checklist

- [ ] Tests are independent and isolated
- [ ] Tests are deterministic (no flakiness)
- [ ] Test names describe behavior being tested
- [ ] Each test has a single reason to fail
- [ ] Tests run fast (< 100ms for unit tests)
- [ ] Tests use meaningful assertions
- [ ] Setup/teardown is minimal and clear

### Behavior-Driven Development (BDD)

BDD bridges the gap between business requirements and technical implementation by using a shared language that all stakeholders understand.

```
Business Need → Executable Specification → Working Software
```

#### Structure: Given-When-Then

Organize tests around three phases:

| Phase     | Purpose                      | Example                                   |
| --------- | ---------------------------- | ----------------------------------------- |
| **Given** | Preconditions, initial state | "a registered user exists"                |
| **When**  | Action being performed       | "the user logs in with valid credentials" |
| **Then**  | Expected outcome             | "the user should see their dashboard"     |

#### Writing Good Scenarios

```
❌ BAD: Implementation details, unclear intent
─────────────────────────────────────────────────────
"open browser, navigate to /login, find element with
id email, type test@test.com, click submit button"

✅ GOOD: Business language, clear intent
─────────────────────────────────────────────────────
Given a registered user exists
When the user logs in with valid credentials
Then the user should see their dashboard
```

#### BDD Best Practices

```
✅ DO                                ❌ DON'T
─────────────────────────────────────────────────────
Write from user's perspective        Use technical jargon
One behavior per scenario            Test multiple things
Use declarative style                Include implementation details
Keep scenarios independent           Share state between scenarios
Use meaningful data                  Use "test", "foo", "bar"
Focus on business outcomes           Focus on UI interactions
```

#### Three Amigos

BDD works best when three perspectives collaborate:

1. **Business/Product**: What problem are we solving?
2. **Development**: How will we build it?
3. **Testing**: What could go wrong?

**Before writing code:**

- Discuss requirements together
- Write scenarios collaboratively
- Agree on acceptance criteria
- Identify edge cases early

### Writing BDD Tests

#### Basic BDD Structure

```typescript
describe("UserService", () => {
  describe("given a new user with valid data", () => {
    const userData = { name: "Alice", email: "alice@example.com" };

    describe("when creating the user", () => {
      it("then the user should be created with an ID", async () => {
        const userService = new UserService();
        const user = await userService.create(userData);

        expect(user.id).toBeDefined();
        expect(user.name).toBe("Alice");
        expect(user.email).toBe("alice@example.com");
      });
    });
  });

  describe("given user data with an invalid email", () => {
    const userData = { name: "Bob", email: "invalid-email" };

    describe("when creating the user", () => {
      it("then it should reject with a validation error", async () => {
        const userService = new UserService();

        await expect(userService.create(userData)).rejects.toThrow(
          "Invalid email",
        );
      });
    });
  });
});
```

#### BDD with Shared Context

```typescript
describe("User Login", () => {
  describe("given a registered user exists", () => {
    let user: User;

    beforeEach(async () => {
      user = await createUser({
        email: "alice@example.com",
        password: "secure123",
      });
    });

    describe("when the user logs in with valid credentials", () => {
      let session: Session;

      beforeEach(async () => {
        session = await login(user.email, "secure123");
      });

      it("then a valid session should be created", () => {
        expect(session.token).toBeDefined();
        expect(session.userId).toBe(user.id);
      });

      it("then the user should be able to access their dashboard", async () => {
        const dashboard = await getDashboard(session);

        expect(dashboard.userId).toBe(user.id);
        expect(dashboard.welcomeMessage).toContain(user.name);
      });
    });

    describe("when the user logs in with wrong password", () => {
      it("then login should fail with authentication error", async () => {
        await expect(login(user.email, "wrongpassword")).rejects.toThrow(
          "Invalid credentials",
        );
      });
    });
  });
});
```

#### BDD Error Handling Tests

```typescript
describe("User Processing", () => {
  describe("given a null user input", () => {
    describe("when processing the user", () => {
      it("then it should throw a validation error", () => {
        expect(() => processUser(null)).toThrow("User cannot be null");
      });
    });
  });

  describe("given an invalid user ID", () => {
    describe("when fetching the user", () => {
      it("then it should throw a ValidationError", async () => {
        await expect(fetchUser(-1)).rejects.toBeInstanceOf(ValidationError);
      });

      it("then the error should include the invalid ID", async () => {
        await expect(fetchUser(-1)).rejects.toThrow(/invalid user id.*-1/i);
      });
    });
  });
});
```

#### BDD with Parametrized Tests

```typescript
describe("Order Discount Calculation", () => {
  describe("given different order totals", () => {
    const testCases = [
      { orderTotal: 50, expectedDiscount: 0, scenario: "order under $100" },
      { orderTotal: 100, expectedDiscount: 10, scenario: "order exactly $100" },
      {
        orderTotal: 250,
        expectedDiscount: 25,
        scenario: "order between $100-$500",
      },
      { orderTotal: 500, expectedDiscount: 75, scenario: "order exactly $500" },
      { orderTotal: 1000, expectedDiscount: 150, scenario: "order over $500" },
    ];

    testCases.forEach(({ orderTotal, expectedDiscount, scenario }) => {
      describe(`given an ${scenario} ($${orderTotal})`, () => {
        describe("when calculating the discount", () => {
          it(`then the discount should be $${expectedDiscount}`, () => {
            const discount = calculateDiscount(orderTotal);
            expect(discount).toBe(expectedDiscount);
          });
        });
      });
    });
  });
});
```

### Finding Untested Code

- Generate coverage reports to see which lines/branches are untested
- Find tests for a specific symbol to see what's covered
- Find untested symbols to identify gaps
- Find what production code a test file touches

### Testing Anti-Patterns

| Anti-Pattern               | Problem                         | Solution                       |
| -------------------------- | ------------------------------- | ------------------------------ |
| **Ice Cream Cone**         | More E2E tests than unit tests  | Invert the pyramid             |
| **Flaky Tests**            | Tests randomly fail             | Fix race conditions, use mocks |
| **Slow Tests**             | Test suite takes too long       | Isolate, parallelize, mock I/O |
| **Testing Implementation** | Tests break on refactor         | Test behavior, not internals   |
| **No Assertions**          | Tests without meaningful checks | Add specific assertions        |
| **Test Data Coupling**     | Tests depend on shared state    | Isolate test data              |

#### BDD Anti-Patterns

| Anti-Pattern           | Problem                  | Solution                     |
| ---------------------- | ------------------------ | ---------------------------- |
| **UI-focused steps**   | Brittle, hard to read    | Use domain language          |
| **Too many steps**     | Hard to understand       | Split into focused scenarios |
| **Incidental details** | Noise obscures intent    | Include only relevant data   |
| **No clear outcome**   | Can't tell what's tested | End with business assertion  |
| **Coupled scenarios**  | Order-dependent tests    | Make scenarios independent   |
| **Developer jargon**   | Business can't validate  | Use ubiquitous language      |

**Detect test anti-patterns:**

- Search for test blocks without assertions
- Run tests with verbose timing to find slow tests

### Test Organization

#### File Structure

```
src/
  users/
    user-service.ts
    user-service.test.ts    # Co-located tests
  orders/
    order-service.ts
    order-service.test.ts

# OR

src/
  users/
    user-service.ts
tests/
  users/
    user-service.test.ts    # Mirrored structure
```

#### Naming Tests (BDD Style)

```typescript
// ❌ BAD: Vague names, no context
it("works", () => {});
it("handles error", () => {});
it("test1", () => {});

// ❌ BAD: Missing Given-When-Then structure
describe("UserService", () => {
  it("creates user", () => {});
  it("throws on invalid email", () => {});
});

// ✅ GOOD: Full BDD structure with Given-When-Then
describe("UserService", () => {
  describe("given valid user data", () => {
    describe("when creating a user", () => {
      it("then the user should be persisted with an ID", () => {});
    });
  });

  describe("given an invalid email format", () => {
    describe("when creating a user", () => {
      it("then a ValidationError should be thrown", () => {});
    });
  });
});
```

---

## Phase 4: Review

Code review checklist and self-review guidelines before PR.

### Self-Review Before PR

Before submitting code for review, run these checks:

#### Automated Checks

- Type check passes
- Linter passes (fix issues)
- Formatter applied
- All tests pass
- Coverage meets threshold

#### Code Quality Checks

- Find unused code
- Find duplicate code
- Check for circular dependencies

#### Manual Checklist

- [ ] Code compiles and runs without errors
- [ ] All tests pass
- [ ] No debug code or console.log left behind
- [ ] No commented-out code
- [ ] Code is properly formatted
- [ ] Branch is up to date with main

### Code Review Checklist

#### Correctness

- [ ] Does the code do what it's supposed to?
- [ ] Are edge cases handled?
- [ ] Are there any obvious bugs?
- [ ] Are error cases properly handled?

**Verify:**

- Trace the call flow to understand what code does
- Find callees of a function to see what it depends on

#### Design

- [ ] Is the code at the right abstraction level?
- [ ] Does it follow SOLID principles?
- [ ] Are there any code smells?
- [ ] Is there unnecessary complexity?
- [ ] Are dependencies appropriate?

**Verify:**

- Find duplicate code
- Check dependency direction
- Check for circular dependencies
- Find unused code

#### Readability

- [ ] Is the code easy to understand?
- [ ] Are names meaningful and consistent?
- [ ] Is the logic straightforward?
- [ ] Are there unnecessary comments? (code should be self-documenting)
- [ ] Is the file organization clear?

**Review:**

- Map module structure to understand organization
- Check naming consistency by querying symbols

#### Maintainability

- [ ] Is the code testable?
- [ ] Are dependencies injected?
- [ ] Is there appropriate documentation for public APIs?
- [ ] Will this be easy to modify in the future?
- [ ] Are magic numbers/strings avoided?

**Find issues:**

- Search for hardcoded numbers (magic values)
- Search for hardcoded strings that should be constants

#### Security

- [ ] Is user input validated?
- [ ] Are there any injection vulnerabilities?
- [ ] Are secrets properly handled?
- [ ] Is authentication/authorization correct?
- [ ] Is sensitive data protected?

**Security checks:**

- Search for string concatenation in queries (SQL injection)
- Search for template literals in queries
- Search for hardcoded passwords and API keys
- Search for eval() usage

#### Performance

- [ ] Are there any obvious performance issues?
- [ ] Are N+1 queries avoided?
- [ ] Is caching considered where appropriate?
- [ ] Are there unnecessary computations?
- [ ] Is memory usage reasonable?

**Find performance issues:**

- Search for await inside loops (N+1 patterns)
- Search for async map/forEach patterns

#### Test Coverage

- [ ] Are there sufficient tests?
- [ ] Do tests cover edge cases?
- [ ] Are tests testing behavior, not implementation?

**Check:**

- Find untested symbols
- Find tests for specific functions
- Run coverage report

### Review Best Practices

#### For Reviewers

- Focus on the code, not the author
- Ask questions rather than make demands
- Explain the "why" behind suggestions
- Distinguish between blocking issues and nitpicks
- Acknowledge good solutions

**Use analysis to support reviews:**

- View the diff to understand what changed
- Find callers of changed functions to trace impact
- Find tests for changed functions to verify coverage

#### For Authors

- Keep PRs small and focused
- Provide context in PR description
- Respond to all comments
- Don't take feedback personally
- Ask for clarification when needed

**Before requesting review:**

- Run all automated checks (type check, lint, tests)
- Self-review the diff
- Check for common issues (unused code, duplication)

### Common Review Questions

**Architecture:**

- Does this belong in this module/layer?
- Are dependencies flowing in the right direction?
- Is this the right level of abstraction?

**Testing:**

- Are there sufficient tests?
- Do tests cover edge cases?
- Are tests testing behavior, not implementation?

**Future-proofing:**

- Will this scale?
- Is this maintainable?
- Are we introducing technical debt?

---

## Phase 5: Maintenance

Guidelines for refactoring, technical debt, performance, and documentation.

### Refactoring

#### Safe Refactoring Steps

1. **Ensure test coverage** before refactoring
2. **Make small, incremental changes**
3. **Run tests after each change**
4. **Commit frequently**
5. **Refactor OR add features**, never both

#### Pre-Refactoring Analysis

- Check test coverage for the code you're refactoring
- Find callers of the function to understand what depends on it
- Find callees of the function to understand what it depends on
- Find duplicate code that should be refactored together

#### Common Refactorings

| Technique                                 | When to Use                           | Analysis                           |
| ----------------------------------------- | ------------------------------------- | ---------------------------------- |
| **Extract Method**                        | Long method, reusable logic           | Search for patterns to replace     |
| **Extract Class**                         | Class has multiple responsibilities   | Find callees to identify groups    |
| **Inline Method**                         | Method body is as clear as name       | Search and replace pattern         |
| **Move Method**                           | Method uses another class's data more | Analyze dependencies               |
| **Rename**                                | Name doesn't reveal intent            | Search and replace across codebase |
| **Replace Conditional with Polymorphism** | Complex type-checking logic           | Search for switch/if chains        |
| **Replace Magic Number with Constant**    | Unexplained numeric literals          | Search for hardcoded values        |
| **Introduce Parameter Object**            | Long parameter lists                  | Search for long parameter patterns |
| **Replace Inheritance with Composition**  | Inheritance is forced                 | Analyze class hierarchy            |

#### Refactoring Workflow

1. **Analyze** - Find callers, callees, and tests for the target
2. **Preview changes** - Dry-run search/replace to see what would change
3. **Apply changes** - Execute the refactoring
4. **Run tests** - Verify nothing broke
5. **Commit** - Save progress with meaningful message

### Technical Debt

#### Types of Technical Debt

| Type                      | Description            | Handling                   | Detection                        |
| ------------------------- | ---------------------- | -------------------------- | -------------------------------- |
| **Deliberate**            | Conscious shortcuts    | Document, schedule payback | Issues tracker                   |
| **Accidental**            | Unintentional issues   | Fix when discovered        | Lint warnings, code review       |
| **Bit Rot**               | Code ages poorly       | Regular maintenance        | Unused code, dependency analysis |
| **Outdated Dependencies** | Security/compatibility | Regular updates            | Dependency audit                 |

#### Finding Technical Debt

- Find unused code (dead code debt) - files, exports, dependencies
- Find duplicate code (DRY violation debt)
- Find circular dependencies (architecture debt)
- Find outdated dependencies

#### Managing Debt

1. **Track it** - Document in issues/backlog
2. **Quantify it** - Estimate effort to fix
3. **Prioritize it** - Balance with features
4. **Pay it down** - Allocate time each sprint
5. **Prevent it** - Code reviews, standards

### Performance

#### Optimization Rules

1. **Don't optimize prematurely** - Make it work first
2. **Measure before optimizing** - Profile to find bottlenecks
3. **Optimize the right thing** - Focus on hot paths
4. **Know the costs** - Understand time/space complexity

#### Common Performance Pitfalls

| Pitfall                 | Solution                           | Detection                 |
| ----------------------- | ---------------------------------- | ------------------------- |
| N+1 queries             | Batch queries, use joins           | Search for await in loops |
| Unnecessary computation | Cache results, lazy evaluation     | Profiling                 |
| Memory leaks            | Clean up references, use weak refs | Memory profiling          |
| Blocking I/O            | Use async operations               | Code review               |
| Large payloads          | Paginate, compress, filter fields  | Network profiling         |
| No indexing             | Add database indexes               | Query analysis            |

**Find performance issues:**

- Search for N+1 query patterns (await inside loops)
- Search for synchronous file operations
- Search for expensive operations in loops (e.g., JSON.parse in loop)

### Cleanup and Maintenance

#### Regular Maintenance Tasks

1. **Update dependencies** - Keep packages current
2. **Check for security issues** - Run security audits
3. **Remove unused code** - Delete unused files/exports
4. **Remove duplicate code** - Extract and reuse
5. **Fix circular dependencies** - Refactor to break cycles
6. **Update outdated patterns** - Modernize legacy code

### Documentation

#### What to Document

```
✅ DOCUMENT                          ❌ SKIP
─────────────────────────────────────────────────────
Public APIs                          Obvious code
Architecture decisions (ADRs)        Implementation details
Setup and deployment                 Every function
Non-obvious behavior                 Self-documenting code
Known limitations                    Temporary hacks (fix them)
```

#### Documentation Types

| Type                | Purpose                       | Location              |
| ------------------- | ----------------------------- | --------------------- |
| **README**          | Project overview, setup       | Repository root       |
| **API Docs**        | Endpoint/function reference   | Generated from code   |
| **ADRs**            | Architecture decisions        | `docs/adr/`           |
| **Runbooks**        | Operational procedures        | `docs/runbooks/`      |
| **Inline Comments** | Non-obvious code explanations | In source code (rare) |

### Architectural Anti-Patterns

| Anti-Pattern               | Problem                           | Solution                     | Detection                   |
| -------------------------- | --------------------------------- | ---------------------------- | --------------------------- |
| **Big Ball of Mud**        | No clear structure                | Define boundaries and layers | Map structure, analyze deps |
| **Golden Hammer**          | Using one solution for everything | Choose right tool for job    | Code review                 |
| **Spaghetti Code**         | Tangled, unstructured code        | Modularize, add structure    | Check circular dependencies |
| **Lava Flow**              | Dead code nobody dares remove     | Document and delete          | Find unused code            |
| **Copy-Paste Programming** | Duplicated code everywhere        | Extract and reuse            | Find duplicate code         |
| **Magic Numbers/Strings**  | Hardcoded values without context  | Use named constants          | Search for hardcoded values |
| **Circular Dependencies**  | Modules depend on each other      | Introduce abstraction layer  | Analyze dependency cycles   |
| **Leaky Abstraction**      | Implementation details leak out   | Strengthen encapsulation     | Check exports vs internals  |

### After Writing Code Checklist

- [ ] Self-review before PR
- [ ] Ensure tests pass
- [ ] Update documentation
- [ ] Clean up debug code
- [ ] Check for unused code
- [ ] Check for duplication
- [ ] Commit with meaningful message

### Code Quality Mantras

```
"Make it work, make it right, make it fast" - Kent Beck
"Any fool can write code that a computer can understand.
 Good programmers write code that humans can understand." - Martin Fowler
"Simplicity is the ultimate sophistication" - Leonardo da Vinci
"The best code is no code at all" - Jeff Atwood
```
