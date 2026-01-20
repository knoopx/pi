# Maintenance Phase

Guidelines for refactoring, technical debt, performance, and documentation.

---

## Refactoring

### Safe Refactoring Steps

1. **Ensure test coverage** before refactoring
2. **Make small, incremental changes**
3. **Run tests after each change**
4. **Commit frequently**
5. **Refactor OR add features**, never both

### Pre-Refactoring Analysis

```bash
# Check test coverage for the code you're refactoring
cm tests functionToRefactor . --format ai
vitest run --coverage

# Understand what depends on this code
cm callers functionToRefactor . --format ai

# Understand what this code depends on
cm callees functionToRefactor . --format ai

# Check for similar code that should be refactored together
npx jscpd src/
```

### Common Refactorings

| Technique | When to Use | Tool Support |
|-----------|-------------|--------------|
| **Extract Method** | Long method, reusable logic | `ast-grep` for pattern replacement |
| **Extract Class** | Class has multiple responsibilities | `cm callees` to identify groups |
| **Inline Method** | Method body is as clear as name | `ast-grep` for inlining |
| **Move Method** | Method uses another class's data more | `cm deps` to find better location |
| **Rename** | Name doesn't reveal intent | `ast-grep` for safe renames |
| **Replace Conditional with Polymorphism** | Complex type-checking logic | `ast-grep` to find switch/if chains |
| **Replace Magic Number with Constant** | Unexplained numeric literals | `ast-grep` to find hardcoded values |
| **Introduce Parameter Object** | Long parameter lists | `ast-grep` to find patterns |
| **Replace Inheritance with Composition** | Inheritance is forced | `cm deps` to analyze hierarchy |

### Refactoring with ast-grep

```bash
# Rename function across codebase
ast-grep run --pattern 'oldFunctionName($$$ARGS)' \
  --rewrite 'newFunctionName($$$ARGS)' --lang typescript --update-all .

# Replace == with ===
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang javascript --update-all .

# Convert var to let
ast-grep run --pattern 'var $NAME = $VALUE' --rewrite 'let $NAME = $VALUE' --lang javascript --update-all .

# Add optional chaining
ast-grep run --pattern '$OBJ && $OBJ.$PROP' --rewrite '$OBJ?.$PROP' --lang javascript --update-all .

# Convert function to arrow function
ast-grep run --pattern 'function $NAME($$$ARGS) { return $EXPR; }' \
  --rewrite 'const $NAME = ($$$ARGS) => $EXPR;' --lang javascript --update-all .

# Convert require to import
ast-grep run --pattern 'const $NAME = require($PATH)' \
  --rewrite 'import $NAME from $PATH' --lang javascript --update-all .
```

### Refactoring Workflow

```bash
# 1. Analyze before refactoring
cm callers targetFunction . --format ai
cm tests targetFunction . --format ai

# 2. Preview changes
ast-grep run --pattern 'oldPattern' --rewrite 'newPattern' --lang typescript .

# 3. Apply changes
ast-grep run --pattern 'oldPattern' --rewrite 'newPattern' --lang typescript --update-all .

# 4. Run tests
vitest run
# or
uv run pytest

# 5. Commit
jj desc -m "refactor: rename oldFunction to newFunction"
```

---

## Technical Debt

### Types of Technical Debt

| Type | Description | Handling | Detection |
|------|-------------|----------|-----------|
| **Deliberate** | Conscious shortcuts | Document, schedule payback | Code comments, issues |
| **Accidental** | Unintentional issues | Fix when discovered | Lint warnings, code review |
| **Bit Rot** | Code ages poorly | Regular maintenance | `knip`, `cm deps` |
| **Outdated Dependencies** | Security/compatibility | Regular updates | `bun outdated` |

### Finding Technical Debt

```bash
# Find unused code (dead code debt)
bunx knip
bunx knip --include files
bunx knip --include exports
bunx knip --include dependencies

# Find duplicate code (DRY violation debt)
npx jscpd src/
npx jscpd --min-tokens 50 --min-lines 5 src/

# Find circular dependencies (architecture debt)
cm deps . --circular --format ai

# Find outdated dependencies
bun outdated
# or
npm outdated

# Find TODO/FIXME comments
grep -r "TODO\|FIXME" src/
ast-grep run --pattern '// TODO: $_' --lang typescript .
ast-grep run --pattern '# TODO: $_' --lang python .
```

### Managing Debt

1. **Track it** - Document in issues/backlog

```bash
# Create issue for tech debt
gh issue create --title "Tech Debt: Refactor user service" \
  --body "Found duplicate code in user validation" \
  --label "tech-debt"
```

2. **Quantify it** - Estimate effort to fix

```bash
# Measure duplication
npx jscpd --reporters json src/ > debt-report.json

# Count unused code
bunx knip --reporter json > unused-code.json
```

3. **Prioritize it** - Balance with features

4. **Pay it down** - Allocate time each sprint

5. **Prevent it** - Code reviews, standards

---

## Performance

### Optimization Rules

1. **Don't optimize prematurely** - Make it work first
2. **Measure before optimizing** - Profile to find bottlenecks
3. **Optimize the right thing** - Focus on hot paths
4. **Know the costs** - Understand time/space complexity

### Common Performance Pitfalls

| Pitfall | Solution | Detection |
|---------|----------|-----------|
| N+1 queries | Batch queries, use joins | `ast-grep` for loop+await patterns |
| Unnecessary computation | Cache results, lazy evaluation | Profiling |
| Memory leaks | Clean up references, use weak refs | Memory profiling |
| Blocking I/O | Use async operations | Code review |
| Large payloads | Paginate, compress, filter fields | Network profiling |
| No indexing | Add database indexes | Query analysis |

### Finding Performance Issues

```bash
# Find N+1 query patterns
ast-grep run --pattern 'for ($$$) { await $QUERY($$$) }' --lang typescript .
ast-grep run --pattern '$ARR.forEach(async ($ITEM) => { await $$$BODY })' --lang typescript .
ast-grep run --pattern 'for $ITEM in $ITERABLE: $$$AWAIT' --lang python .

# Find synchronous file operations
ast-grep run --pattern 'fs.readFileSync($$$ARGS)' --lang typescript .
ast-grep run --pattern 'fs.writeFileSync($$$ARGS)' --lang typescript .

# Find expensive operations in loops
ast-grep run --pattern 'for ($$$) { $$$JSON.parse($$$)$$$ }' --lang typescript .
```

### Profiling Tests

```bash
# TypeScript/JavaScript - run with verbose timing
vitest run --reporter=verbose | grep -E "[0-9]+ms"

# Find slow tests
vitest run --reporter=verbose 2>&1 | sort -t'(' -k2 -n -r | head -20

# Python - run with timing
uv run pytest --durations=10
```

---

## Cleanup and Maintenance

### Regular Maintenance Tasks

```bash
# 1. Update dependencies
bun update
# or
uv sync --upgrade

# 2. Check for security issues
bun audit
# or
npm audit

# 3. Remove unused code
bunx knip
# Review and delete unused files/exports

# 4. Remove duplicate code
npx jscpd src/
# Refactor duplicates

# 5. Fix circular dependencies
cm deps . --circular --format ai
# Refactor to break cycles

# 6. Update outdated patterns
ast-grep run --pattern 'oldPattern' --rewrite 'newPattern' --lang typescript --update-all .
```

### Version Control Maintenance

```bash
# Clean up old changes
jj abandon @-   # Abandon parent change if not needed
jj squash       # Squash into parent

# Rebase on latest main
jj rebase -s @ -d main

# Push changes
jj git push --bookmark main
```

---

## Documentation

### What to Document

```
✅ DOCUMENT                          ❌ SKIP
─────────────────────────────────────────────────────
Public APIs                          Obvious code
Architecture decisions (ADRs)        Implementation details
Setup and deployment                 Every function
Non-obvious behavior                 Self-documenting code
Known limitations                    Temporary hacks (fix them)
```

### Documentation Types

| Type | Purpose | Location |
|------|---------|----------|
| **README** | Project overview, setup | Repository root |
| **API Docs** | Endpoint/function reference | Generated from code |
| **ADRs** | Architecture decisions | `docs/adr/` |
| **Runbooks** | Operational procedures | `docs/runbooks/` |
| **Inline Comments** | Non-obvious code explanations | In source code (rare) |

### Generating Documentation

```bash
# View public API structure
cm map . --level 2 --exports-only --format ai

# Generate API documentation from code
# TypeScript: Use TypeDoc
bunx typedoc src/

# Python: Use Sphinx or pdoc
uv run pdoc src/my_project
```

---

## Architectural Anti-Patterns

| Anti-Pattern | Problem | Solution | Detection |
|--------------|---------|----------|-----------|
| **Big Ball of Mud** | No clear structure | Define boundaries and layers | `cm map`, `cm deps` |
| **Golden Hammer** | Using one solution for everything | Choose right tool for job | Code review |
| **Spaghetti Code** | Tangled, unstructured code | Modularize, add structure | `cm deps --circular` |
| **Lava Flow** | Dead code nobody dares remove | Document and delete | `knip` |
| **Copy-Paste Programming** | Duplicated code everywhere | Extract and reuse | `jscpd` |
| **Magic Numbers/Strings** | Hardcoded values without context | Use named constants | `ast-grep` |
| **Circular Dependencies** | Modules depend on each other | Introduce abstraction layer | `cm deps --circular` |
| **Leaky Abstraction** | Implementation details leak out | Strengthen encapsulation | `cm map --exports-only` |

### Detecting Anti-Patterns

```bash
# Big Ball of Mud / Spaghetti Code
cm deps . --circular --format ai
cm map . --level 1 --format ai  # Check structure

# Lava Flow / Dead Code
bunx knip

# Copy-Paste Programming
npx jscpd src/

# Magic Numbers
ast-grep run --pattern '$VAR = 86400' --lang typescript .
ast-grep run --pattern 'setTimeout($FN, $_)' --lang typescript .

# Circular Dependencies
cm deps . --circular --format ai

# Leaky Abstractions
cm map ./src/module --level 2 --exports-only --format ai
# Check if internal types are exported
```

---

## After Writing Code Checklist

- [ ] Self-review before PR
- [ ] Ensure tests pass
- [ ] Update documentation
- [ ] Clean up debug code
- [ ] Run `knip` to check for unused code
- [ ] Run `jscpd` to check for duplication
- [ ] Commit with meaningful message

```bash
# Final checks before committing
vitest run                           # Tests pass
bunx tsc --noEmit                    # Types check
bunx eslint src/                     # Lint clean
bunx knip                            # No unused code
npx jscpd src/                       # No new duplication
jj desc -m "type(scope): description"  # Commit
```

---

## Code Quality Mantras

```
"Make it work, make it right, make it fast" - Kent Beck
"Any fool can write code that a computer can understand.
 Good programmers write code that humans can understand." - Martin Fowler
"Simplicity is the ultimate sophistication" - Leonardo da Vinci
"The best code is no code at all" - Jeff Atwood
```

---

## Related Skills

- **codemapper**: Analyze dependencies with `cm deps`, find callers/callees
- **ast-grep**: Automated refactoring with pattern matching
- **knip**: Find and remove unused code
- **jscpd**: Detect duplicate code for extraction
- **jujutsu**: Version control for safe refactoring (frequent commits)
- **gh**: Track tech debt with issues, create cleanup PRs
- **bun**: Update dependencies with `bun update`, `bun outdated`
- **vitest**: Ensure refactoring doesn't break tests
- **python**: pytest, ruff for Python maintenance
