# STRICT REQUIREments

- **FIRST RUN THE COMMAND `tree -d -I node_modules`**
- **ALWAYS READ AND MAKE USE OF GIVEN USER REFERENECS, ALL AVAILABLE DOCUMENTATION FROM USED LIBRARIES AND FRAMEWORKS, LINKS, SKILLS AND TOOLS BEFORE ATTEMPTING ANY MODification, EXPLORE AS MUCH AS NEEDED UNTIL YOU HAVE A CLEAR IDEA OF THE CONTEXT, REQUEST AND OUTPUT. PREFER SPECIALIZED TOOLS OVER BASIC BASH TOOLS**
- **ALWAYS FOLLOW SOFTWARE ENGINEERING BEST PRACTICES AS DEFINED BY SWE SKILL**
- **ALWAYS LAUNCH INTERACTIVE AND BLOCKING COMMANDS IN TMUX SESSIONS**
- **ALWAYS SPAWN DEV SERVERs ON TMUX SESSIONs IF NOT ALREADY RUNNING**: Use `tmux has -t devserver || tmux new-session -d -s devserver 'bun run dev'` to ensure dev servers start in background sessions
- **YOUR WORK IS DONE ONCE: THE FEATURE OR FIX Is ARCHITECTURALLY SOUND, COMPLETELY IMPLEMENTED, HAS NO CODE DUPLICATION, FULLy TYPECHECKS, LINTS AND PASSES ALL THE TESTs, DON't STOP OR BOTHER THE USER UNTIL ALL OF THE REQUIRED STEPs ARE COMLETED**
- **ALWAYS NOTIFY USER using notify tool WHEN YOU ARE DONE**
- **ALWAYS IGNORE NODE_MODULES WHEN RUNING GREP OR FIND**

# SOFTWARE ENGINEERING BEST PRACTICES

> **Core Principle**: Simple, working code beats clever, complex code. Prefer clarity over cleverness.

## Implementation Phase

### Self-Documenting Code

- **Write code that explains itself. Avoid inline comments.**
- Comments are a code smell - they indicate the code isn't clear enough
- When you feel the need to write a comment, first try to:
  1. Rename variables/functions to be more descriptive
  2. Extract complex logic into well-named functions
  3. Break down long expressions into meaningful intermediates
- **Only acceptable comments:** `TODO:`/`FIXME:` for tracked technical debt, links to external documentation, legal/license headers, warnings about non-obvious side effects

### File Organization

- **Follow existing project structure. Be consistent.**
- **Directory structure**: Consistent organization - don't create "dumping grounds" or vague files
- **Follow existing code structure**: Consistency trumps personal preference
- **Avoid barrel files and re-exports**: `index.ts` re-exporting siblings is an anti-pattern
- **Import from concrete modules**: `import { userService } from "./users/user-service";` (not `./users`)

### Function Design

- **Small, focused functions**: 2-3 parameters max, return early for edge cases
- **Pure functions when possible**: Avoid hidden side effects
- **Descriptive names**: No abbreviations
- **Single level of abstraction**: Don't mix high and low-level thinking
- **Analyze function complexity**: Use `cm callees` to see what a function calls

### Error Handling

- **Fail fast and loud**: Don't swallow exceptions silently
- **Use specific exception types**: Never catch generic Exception
- **Include context in error messages**: Return proper error objects, not nulls
- **Validate inputs at boundaries**: Never trust external data
- **Log errors with stack traces**: Don't log without context
- **Use Result/Either types**: Avoid magic values (-1, null, undefined)
- **Handle errors at appropriate level**: Don't handle everywhere or nowhere
- **Let unexpected errors propagate**: Don't catch everything "just in case"
- **Never Silence Exceptions**: Don't catch exceptions unless you can handle them meaningfully
  - Empty catch blocks are always wrong
  - Catch only exceptions you can meaningfully handle
  - Re-throw or propagate everything else
  - If you catch, either recover or add context and re-throw
  - Prefer crashing visibly over failing silently

### Code Smells to Detect

- **God Class**: Class knows/does too much → Split into focused classes
- **Feature Envy**: Method uses other class's data more → Move method to that class
- **Data Clumps**: Same data groups appear together → Extract into a class
- **Primitive Obsession**: Using primitives for domain concepts → Create value objects
- **Long Parameter List**: Functions with 5+ parameters → Use parameter object
- **Shotgun Surgery**: One change affects many classes → Consolidate related code
- **Divergent Change**: One class changed for many reasons → Split by responsibility
- **Dead Code**: Unused code left in codebase → Delete it
- **Speculative Generality**: Code for hypothetical futures → Delete until needed

## Design Phase

### Before Writing Code

- Understand the requirements
- Consider edge cases
- Plan the approach
- Think about testing

### Tools for Understanding Existing Code

```bash
cm stats . --format ai
cm map . --level 2 --format ai
cm query main . --format ai
cm callees main . --format ai
cm deps . --format ai
cm deps . --circular --format ai  # Check for issues
```

### Core Principles

- **SOLID Principles**: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **DRY**: Don't Repeat Yourself - Extract common logic, but don't over-abstract
- **KISS**: Keep It Simple, Stupid - Prefer clarity over cleverness
- **YAGNI**: You Aren't Gonna Need It - Don't build features until needed

### Simplicity Over Complexity

**Simple, working code beats clever, complex code.**

```
❌ OverengineERed                    ✅ Simple
─────────────────────────────────────────────────────
AbstractFactoryProvider              Direct instantiation
5 layers of indirection              1-2 layers max
Generic solution for 1 use case      Specific solution that works
"Future-proof" architecture          Solve today's problem
Premature optimization               Optimize when needed
Configuration for everything         Sensible defaults
```

### Single Responsibility

**Each function/class/module should do ONE thing well.**

### The Rule of Three

Duplicate code twice before extracting. Premature abstraction is worse than duplication.

### Avoid Legacy Code and Backwards Compatibility

- Delete deprecated code, don't mark it
- Don't write shims or polyfills unless asked
- Don't maintain multiple code paths for old/new
- Don't add version checks or feature detection unnecessarily
- If refactoring, replace entirely - don't add parallel implementations

### Feature Flags Are a Code Smell

Conditional logic based on flags/modes creates maintenance nightmares.

### Architecture: Layered Architecture

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

**✅ GOOD**: Domain → nothing, Application → Domain, Infrastructure → Domain
**❌ BAD**: Domain → Infrastructure, Circular dependencies

### Design Patterns

Use patterns when they solve a real problem, not preemptively.

- **Creational**: Factory, Builder, Singleton, Prototype
- **Structural**: Adapter, Facade, Decorator, Composite
- **Behavioral**: Strategy, Observer, Command, State

### Security by Design

- Validate all external input
- Use allowlists over denylists
- Never store plaintext passwords
- Encrypt sensitive data at rest and in transit
- Never log sensitive information
- Use parameterized queries (prevent SQL injection)
- Escape output (prevent XSS)
- Never commit secrets to version control

## Review Phase

### Code Quality Checks

```bash
# Find unused code
bunx knip

# Find duplicate code
npx jscpd src/

# Check dependencies
cm deps . --circular --format ai     # No circular deps
```

### Code Review Checklist

**Correctness**: Does the code do what it's supposed to? Are edge cases handled?
**Design**: Is the code at the right abstraction level? Does it follow SOLID principles?
**Readability**: Is the code easy to understand? Are names meaningful?
**Maintainability**: Is the code testable? Are dependencies injected?
**Security**: Is user input validated? Are there injection vulnerabilities?
**Performance**: Are there obvious performance issues? Are N+1 queries avoided?
**Test Coverage**: Are there sufficient tests? Do tests cover edge cases?

### Common Review Questions

**Architecture**: Does this belong in this module/layer? Are dependencies flowing correctly?
**Testing**: Are there sufficient tests? Do tests cover edge cases?
**Future-proofing**: Will this scale? Is this maintainable? Are we introducing technical debt?

## Testing Phase

### What to Test

```
✅ Test                              ❌ Skip
─────────────────────────────────────────────────────
Business logic                       Framework code
Edge cases and boundaries            Trivial getters/setters
Error handling paths                 Third-party libraries
Public API contracts                 Private implementation details
Integration points                   UI layout (use visual tests)
Security-sensitive code              Configuration files
```

### Test Quality Checklist

- Tests are independent and isolated
- Tests are deterministic (no flakiness)
- Test names describe behavior being tested
- Each test has a single reason to fail
- Tests run fast (< 100ms for unit tests)
- Tests use meaningful assertions
- Setup/teardown is minimal and clear

### Behavior-Driven Development (BDD)

Organize tests around three phases:

- **Given**: Preconditions, initial state
- **When**: Action being performed
- **Then**: Expected outcome

**BDD Best Practices**:

- Write from user's perspective
- One behavior per scenario
- Use declarative style
- Keep scenarios independent
- Use meaningful data
- Focus on business outcomes

### Testing Anti-Patterns

- **Ice Cream Cone**: More E2E tests than unit tests → Invert the pyramid
- **Flaky Tests**: Tests randomly fail → Fix race conditions, use mocks
- **Slow Tests**: Test suite takes too long → Isolate, parallelize, mock I/O
- **Testing Implementation**: Tests break on refactor → Test behavior, not internals
- **No Assertions**: Tests without meaningful checks → Add specific assertions
- **Test Data Coupling**: Tests depend on shared state → Isolate test data

### Test Organization

- **File Structure**: Co-locate tests with code or mirror structure
- **Naming Tests (BDD Style)**: Use full Given-When-Then structure
- **Avoid vague names**: Use descriptive scenarios

## Tools Available

### Code Analysis Tools

- **codemapper**: Analyze function complexity with `cm callees`, `cm inspect`, `cm deps`, `cm callers`, `cm query`, `cm map`, `cm stats`, `cm trace`
- **ast-grep**: Search code by AST patterns and perform structural refactoring. Find function calls, replace code patterns, or refactor syntax that regex cannot reliably match.
- **jscpd**: Detect code duplication
- **knip**: Find dead code and unused exports

### tmux: Terminal Multiplexer for Background Processes

**Quick Reference:**
| Command | Description |
| ------------------------------------- | --------------------------------- |
| `tmux new -d -s name 'cmd'` | Run command in background session |
| `tmux capture-pane -t name -p` | Capture output from session |
| `tmux send-keys -t name 'text' Enter` | Send input to session |
| `tmux kill-session -t name` | Terminate session |
| `tmux ls` | List all sessions |
| `tmux has -t name` | Check if session exists |

**Running Background Processes:**

```bash
# Run a command in a new detached session
tmux new-session -d -s myserver 'python -m http.server 8080'

# With a specific working directory
tmux new-session -d -s build -c /path/to/project 'make build'

# Run shell command and keep session alive after completion
tmux new-session -d -s task 'command; exec bash'
```

**Capturing Output:**

```bash
# Capture visible output (prints to stdout)
tmux capture-pane -t mysession -p

# Capture entire scrollback history
tmux capture-pane -t mysession -p -S -

# Capture last N lines
tmux capture-pane -t mysession -p -S -100

# Save to file
tmux capture-pane -t mysession -p > output.txt
```

**Sending Input:**

```bash
# Send text to the active pane
tmux send-keys -t mysession 'echo hello' Enter

# Send multiple keystrokes
tmux send-keys -t mysession 'cd /path/to/project' Enter
```

**Session Management:**

```bash
# List all tmux sessions
tmux list-sessions

# Kill a specific session
tmux kill-session -t myserver

# Kill all sessions
tmux kill-server

# Check if session exists
tmux has -t mysession

# Create session only if it doesn't exist
tmux has -t myserver || tmux new-session -d -s myserver 'command'
```

**Development Server Templates:**

```bash
# Run a web server in background
tmux new-session -d -s webserver 'bun run dev'

# Run a database in background
tmux new-session -d -s database 'docker run -d postgres:alpine'

# Run multiple services
tmux new-session -d -s backend 'bun run backend'
tmux new-session -d -s frontend 'bun run frontend'
tmux new-session -d -s tests 'vitest --watch'

# Run tests with watch mode
tmux new-session -d -s tests 'vitest --watch'

# Run tests and wait for completion
tmux new-session -d -s tests 'vitest && tmux wait-for -S tests-done'
```

**Tips:**

- Use `tmux new-session -d` for background processes
- Use `tmux capture-pane -p -S -` for full scrollback
- Use `tmux has -t name` to check session existence
- Use `tmux kill-server` to clean up all sessions
- Use `tmux list-sessions` to see all active sessions
- Use `tmux send-keys -t name 'text' Enter` to send input
- Use `tmux new-session -d -s name 'command'` for quick commands
- Use `tmux new-session -d -s name -c /path command` for custom directories
- Use `tmux new-session -d -s name 'command; exec bash'` to keep session alive
- Use `tmux new-session -d -s name 'command; tmux wait-for -S name-done'` for completion tracking

### ast-grep: AST-Based Code Search and Refactoring

**Pattern Syntax:**

- `$VAR` - Match a single AST node and capture it as `VAR`
- `$$$VAR` - Match zero or more AST nodes (spread) and capture as `VAR`
- `$_` - Anonymous placeholder (matches any single node, no capture)
- `$$$_` - Anonymous spread placeholder (matches any number of nodes)

**Supported Languages:** javascript, typescript, tsx, html, css, python, go, rust, java, c, cpp, csharp, ruby, php, yaml

**Commands:**

- `ast-grep run` - One-time search or rewrite (default)
- `ast-grep scan` - Scan and rewrite by configuration
- `ast-grep test` - Test ast-grep rules
- `ast-grep new` - Create new project or rules
- `ast-grep lsp` - Start language server

**Basic Search:**

```bash
# Find console.log calls
ast-grep run --pattern 'console.log($$$ARGS)' --lang javascript .

# Find React useState hooks
ast-grep run --pattern 'const [$STATE, $SETTER] = useState($INIT)' --lang tsx .

# Find async functions
ast-grep run --pattern 'async function $NAME($$$ARGS) { $$$BODY }' --lang typescript .

# Find Express route handlers
ast-grep run --pattern 'app.$METHOD($PATH, ($$$ARGS) => { $$$BODY })' --lang javascript .

# Find Python function definitions
ast-grep run --pattern 'def $NAME($$$ARGS): $$$BODY' --lang python .

# Find Go error handling
ast-grep run --pattern 'if $ERR != nil { $$$BODY }' --lang go .
```

**Search and Replace (Dry Run):**

```bash
# Preview refactoring changes without modifying files
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang javascript .

# Convert function to arrow function (preview)
ast-grep run --pattern 'function $NAME($$$ARGS) { $$$BODY }' \
  --rewrite 'const $NAME = ($$$ARGS) => { $$$BODY }' --lang javascript .

# Replace var with let (preview)
ast-grep run --pattern 'var $NAME = $VALUE' --rewrite 'let $NAME = $VALUE' --lang javascript .

# Add optional chaining (preview)
ast-grep run --pattern '$OBJ && $OBJ.$PROP' --rewrite '$OBJ?.$PROP' --lang javascript .
```

**Apply Changes:**

```bash
# Apply changes (use --update-all)
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang javascript --update-all .
```

**Project Setup:**

```bash
# Initialize a new ast-grep project
ast-grep new my-refactor-rules

# Add rules to your project
cat > rules/my-rule.yaml << 'EOF'
patterns:
  - pattern: 'console.log($$$ARGS)'
    rewrite: 'logger.info($$$ARGS)'
    languages: [javascript, typescript]
EOF

# Run your custom rules
ast-grep scan --project my-refactor-rules
```

**Common Refactoring Examples:**

```bash
# Convert Function Declarations to Arrow Functions
ast-grep run --pattern 'function $NAME($$$ARGS) { $$$BODY }' \
  --rewrite 'const $NAME = ($$$ARGS) => { $$$BODY }' --lang typescript .

# Replace Equality Operators
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang typescript .

# Add Optional Chaining
ast-grep run --pattern '$OBJ && $OBJ.$PROP' --rewrite '$OBJ?.$PROP' --lang typescript .

# Add JSDoc Comments
ast-grep run --pattern 'function $NAME($$$ARGS) { $$$BODY }' \
  --rewrite '/** @param {$$$ARGS} @returns {ReturnType<$NAME>} */\nfunction $NAME($$$ARGS) { $$$BODY }' --lang typescript .

# Python-Specific Refactoring
ast-grep run --pattern 'print($$$_)' --rewrite 'logger.info($$$_)' --lang python .

# JavaScript-Specific Refactoring
ast-grep run --pattern 'var $NAME = $VALUE' --rewrite 'const $NAME = $VALUE' --lang javascript .

# Add error handling
ast-grep run --pattern 'function $NAME($$$ARGS) { $$$BODY }' \
  --rewrite 'async function $NAME($$$ARGS) { try { $$$BODY } catch (error) { throw error } }' --lang typescript .
```

**Tips:**

- Use `--dry-run` to preview changes before applying
- Use `--update-all` to apply to all matching files
- Use `--lang` to specify the language for pattern matching
- Use single quotes for patterns with `$` variables to avoid shell expansion
- Escape `$` as `\$VAR` when using double quotes
- Combine with `--verbose` to see detailed matching information
- Use `--test` to validate pattern correctness

**Related Tools:**

- **codemapper**: Alternative pattern-based refactoring tool
- **typescript**: Type-safe AST manipulation
- **python**: AST parsing and manipulation

### Linting & Formatting

- **TypeScript/JavaScript**: ESLint (lint), Prettier (format), TypeScript (type check)
- **Python**: Ruff (format, lint), mypy (type check)

### Testing

- **TypeScript/JavaScript**: Vitest
- **Python**: pytest

## While Writing Code Checklist

- [ ] Write tests first (or alongside)
- [ ] Keep functions small and focused
- [ ] Use meaningful names
- [ ] Handle errors properly
- [ ] Run linter and fix issues
- [ ] Format code before committing
- [ ] Type check passes

## Related Skills

- **codemapper**: Analyze function complexity, understand architecture
- **ast-grep**: Search for patterns, detect design issues
- **jscpd**: Detect code duplication violating DRY
- **knip**: Find dead code and unused dependencies
- **tmux**: Terminal multiplexer for background processes, output capture, and session management. Use for running long-running commands, capturing output from detached processes, or managing concurrent tasks in headless environments.
- **typescript**: Type definitions, strict mode, type guards
- **python**: ruff format, ruff check, mypy for Python projects
- **vitest**: Write and run tests alongside implementation
- **gh**: Create PRs, review, merge with GitHub CLI
