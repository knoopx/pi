# Implementation Phase

Guidelines for self-documenting code, naming, functions, error handling, and avoiding code smells.

---

## Self-Documenting Code

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
- `TODO:` / `FIXME:` for tracked technical debt
- Links to external documentation (bug trackers, RFCs, specs)
- Legal/license headers
- Warnings about non-obvious side effects or gotchas

---

## Naming Conventions

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

### Avoid Ambiguous Parameters

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

### Naming Guidelines by Type

| Type | Convention | Examples |
|------|------------|----------|
| **Variables** | camelCase, noun/noun phrase | `userName`, `activeCount`, `isValid` |
| **Functions** | camelCase, verb/verb phrase | `getUser`, `calculateTotal`, `validateInput` |
| **Booleans** | Prefix: `is`, `has`, `can`, `should` | `isActive`, `hasPermission`, `canEdit` |
| **Constants** | UPPER_SNAKE_CASE | `MAX_RETRIES`, `API_BASE_URL` |
| **Classes** | PascalCase, noun | `UserService`, `OrderRepository` |
| **Interfaces** | PascalCase, noun/adjective | `Serializable`, `UserConfig` |
| **Enums** | PascalCase (name), UPPER_SNAKE (values) | `Status.PENDING`, `Role.ADMIN` |
| **Private members** | Prefix `_` or `#` | `_cache`, `#internalState` |

**Find naming issues with codemapper:**

```bash
# List all symbols to review naming consistency
cm map . --level 3 --format ai

# Query specific symbols to check naming patterns
cm query get . --format ai
cm query process . --format ai
```

---

## File Organization

### File Naming Conventions

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

### Directory Structure

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

### Follow Existing Code Structure

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

### Avoid Barrel Files and Re-exports

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

**Analyze existing patterns with codemapper:**

```bash
# Understand project structure
cm map . --level 2 --format ai

# See how existing services are structured
cm inspect ./src/users/user-service.ts --format ai

# Check existing naming conventions
cm query Service . --format ai
```

---

## Function Design

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

```bash
# See what a function calls (too many = does too much)
cm callees functionName . --format ai

# Check function body for complexity
cm query functionName . --show-body --format ai
```

---

## Error Handling

### Best Practices

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

### Never Silence Exceptions

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
  throw new UserServiceError(`Failed to save user ${user.id}`, { cause: error });
}
```

**Find empty catch blocks with ast-grep:**

```bash
# Find empty catch blocks (TypeScript/JavaScript)
ast-grep run --pattern 'catch ($ERR) { }' --lang typescript .
ast-grep run --pattern 'catch ($ERR) { }' --lang javascript .

# Find catch blocks that only log
ast-grep run --pattern 'catch ($ERR) { console.log($$$ARGS); }' --lang typescript .

# Find catch blocks that only console.error
ast-grep run --pattern 'catch ($ERR) { console.error($$$ARGS); }' --lang typescript .

# Python: find bare except
ast-grep run --pattern 'except: $$$BODY' --lang python .
ast-grep run --pattern 'except Exception: pass' --lang python .
```

**Rules:**
- Empty catch blocks are always wrong
- Catch only exceptions you can meaningfully handle
- Re-throw or propagate everything else
- If you catch, either recover or add context and re-throw
- Prefer crashing visibly over failing silently

### Error Handling Patterns

```typescript
// ✅ Result type pattern
type Result<T, E = Error> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

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
  
  return performAction(user);  // Happy path
}
```

---

## Code Smells

| Smell | Description | Refactoring | Detection Tool |
|-------|-------------|-------------|----------------|
| **God Class** | Class knows/does too much | Split into focused classes | `cm callees`, `cm inspect` |
| **Feature Envy** | Method uses other class's data more | Move method to that class | `cm deps` |
| **Data Clumps** | Same data groups appear together | Extract into a class | `jscpd` |
| **Primitive Obsession** | Using primitives for domain concepts | Create value objects | `ast-grep` |
| **Long Parameter List** | Functions with 5+ parameters | Use parameter object | `ast-grep` |
| **Shotgun Surgery** | One change affects many classes | Consolidate related code | `cm callers` |
| **Divergent Change** | One class changed for many reasons | Split by responsibility | `cm inspect` |
| **Dead Code** | Unused code left in codebase | Delete it | `knip` |
| **Speculative Generality** | Code for hypothetical futures | Delete until needed | `knip` |

**Detect code smells:**

```bash
# Find dead code
bunx knip

# Find duplicate code (Data Clumps pattern)
npx jscpd src/

# Find god functions (too many calls)
cm callees suspectedGodFunction . --format ai

# Find long parameter lists
ast-grep run --pattern 'function $NAME($A, $B, $C, $D, $E, $$$REST) { $$$BODY }' --lang typescript .

# Find unused exports
bunx knip --include exports
```

---

## Comments (Avoid Them)

**Prefer self-documenting code over comments. Comments are a last resort.**

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

✅ ACCEPTABLE COMMENTS (Rare exceptions)
─────────────────────────────────────────────────────
// TODO: Optimize for large datasets (tracked in #1234)
// FIXME: Race condition under load (see issue #567)
// HACK: Workaround for browser bug https://bugs.webkit.org/12345
// WARNING: This mutates the input array for performance
// See RFC 7231 Section 6.5.4 for status code semantics
```

**If you need a comment, refactor first:**

```typescript
// ❌ Comment explaining complex condition
// Check if user can perform action
if (user.role === 'admin' || (user.role === 'editor' && resource.ownerId === user.id)) {

// ✅ Extract to self-documenting function
if (userCanModifyResource(user, resource)) {

function userCanModifyResource(user: User, resource: Resource): boolean {
  const isAdmin = user.role === 'admin';
  const isResourceOwner = resource.ownerId === user.id;
  const isEditor = user.role === 'editor';
  return isAdmin || (isEditor && isResourceOwner);
}
```

**Extract with ast-grep:**

```bash
# Find complex conditions that should be extracted
ast-grep run --pattern 'if ($A && $B && $C) { $$$BODY }' --lang typescript .
ast-grep run --pattern 'if ($A || $B || $C) { $$$BODY }' --lang typescript .
```

---

## Linting & Code Formatting

**Automate style enforcement. Don't argue about formatting in code reviews.**

### Principles

| Principle | Why |
|-----------|-----|
| **Automate formatting** | Eliminates bikeshedding, ensures consistency |
| **Use recommended rules** | Battle-tested defaults, less configuration |
| **Lint on save/commit** | Catch issues early, before PR |
| **Zero warnings policy** | Treat warnings as errors in CI |
| **Format on save** | Never commit unformatted code |

### Recommended Setup by Language

**TypeScript/JavaScript:**

```bash
# Format code
bunx prettier --write "src/**/*.ts"

# Lint code
bunx eslint src/ --fix

# Type check
bunx tsc --noEmit
```

**Python:**

```bash
# Format code
uv run ruff format .

# Lint code
uv run ruff check . --fix

# Type check
uv run mypy src/
```

### Separation of Concerns

| Tool | Purpose | Examples |
|------|---------|----------|
| **Formatter** | Code style (spacing, quotes, etc.) | Prettier, dprint, Biome, ruff format |
| **Linter** | Code quality (bugs, patterns) | ESLint, Biome, Ruff, Pylint |
| **Type checker** | Type safety | TypeScript, mypy, Pyright |

**Don't overlap responsibilities.** Use Prettier for formatting, ESLint for logic issues. Disable ESLint formatting rules when using Prettier.

### When to Disable Rules

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

---

## While Writing Code Checklist

- [ ] Write tests first (or alongside) - see [vitest skill](../vitest/SKILL.md)
- [ ] Keep functions small and focused
- [ ] Use meaningful names
- [ ] Handle errors properly
- [ ] Run linter and fix issues
- [ ] Format code before committing
- [ ] Type check passes - see [typescript skill](../typescript/SKILL.md)

---

## Related Skills

- **codemapper**: Analyze function complexity with `cm callees`, `cm inspect`
- **ast-grep**: Find and fix code patterns, detect anti-patterns
- **knip**: Find dead code and unused exports
- **jscpd**: Detect code duplication
- **typescript**: Type definitions, strict mode, type guards
- **python**: ruff format, ruff check, mypy for Python projects
- **vitest**: Write and run tests alongside implementation
