# Review Phase

Code review checklist and self-review guidelines before PR.

---

## Self-Review Before PR

Before submitting code for review, run these checks:

### Automated Checks

```bash
# TypeScript/JavaScript
bunx tsc --noEmit                    # Type check
bunx eslint src/ --fix               # Lint
bunx prettier --write "src/**/*.ts"  # Format
vitest run                           # Tests
vitest run --coverage                # Coverage

# Python
uv run mypy src/                     # Type check
uv run ruff check . --fix            # Lint
uv run ruff format .                 # Format
uv run pytest                        # Tests
uv run pytest --cov=src              # Coverage
```

### Code Quality Checks

```bash
# Find unused code
bunx knip

# Find duplicate code
npx jscpd src/

# Check dependencies
cm deps . --circular --format ai     # No circular deps
```

### Manual Checklist

- [ ] Code compiles and runs without errors
- [ ] All tests pass
- [ ] No debug code or console.log left behind
- [ ] No commented-out code
- [ ] Code is properly formatted
- [ ] Branch is up to date with main

---

## Creating a Pull Request

### Using GitHub CLI

```bash
# Create PR with auto-filled title and body from commits
gh pr create --fill

# Create PR with title and body
gh pr create --title "feat: add user authentication" --body "Description here"

# Create draft PR
gh pr create --fill --draft

# Create PR targeting specific branch
gh pr create --base develop --fill
```

### PR Description Template

```markdown
## Summary
Brief description of changes.

## Changes
- Added X
- Modified Y
- Removed Z

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Related Issues
Closes #123
```

---

## Code Review Checklist

### Correctness

- [ ] Does the code do what it's supposed to?
- [ ] Are edge cases handled?
- [ ] Are there any obvious bugs?
- [ ] Are error cases properly handled?

**Verify with tools:**

```bash
# Trace the flow to understand what code does
cm trace entryPoint targetFunction . --format ai

# Check what the function calls
cm callees functionName . --format ai
```

### Design

- [ ] Is the code at the right abstraction level?
- [ ] Does it follow SOLID principles?
- [ ] Are there any code smells?
- [ ] Is there unnecessary complexity?
- [ ] Are dependencies appropriate?

**Verify with tools:**

```bash
# Check for code duplication
npx jscpd src/

# Check dependency direction
cm deps ./src/module --format ai

# Check for circular dependencies
cm deps . --circular --format ai

# Find unused code
bunx knip
```

### Readability

- [ ] Is the code easy to understand?
- [ ] Are names meaningful and consistent?
- [ ] Is the logic straightforward?
- [ ] Are there unnecessary comments? (code should be self-documenting)
- [ ] Is the file organization clear?

**Review with tools:**

```bash
# Understand module structure
cm map ./src/changed-module --level 2 --format ai

# Check naming consistency
cm query functionName . --format ai
```

### Maintainability

- [ ] Is the code testable?
- [ ] Are dependencies injected?
- [ ] Is there appropriate documentation for public APIs?
- [ ] Will this be easy to modify in the future?
- [ ] Are magic numbers/strings avoided?

**Find magic numbers with ast-grep:**

```bash
# Find hardcoded numbers
ast-grep run --pattern '$VAR = 86400' --lang typescript .
ast-grep run --pattern 'setTimeout($FN, 5000)' --lang typescript .

# Find hardcoded strings that should be constants
ast-grep run --pattern '"https://$$$"' --lang typescript .
```

### Security

- [ ] Is user input validated?
- [ ] Are there any injection vulnerabilities?
- [ ] Are secrets properly handled?
- [ ] Is authentication/authorization correct?
- [ ] Is sensitive data protected?

**Security checks with ast-grep:**

```bash
# Find potential SQL injection
ast-grep run --pattern 'query($A + $B)' --lang typescript .
ast-grep run --pattern 'query(`$$$`)' --lang typescript .

# Find hardcoded secrets
ast-grep run --pattern 'password = "$_"' --lang typescript .
ast-grep run --pattern 'apiKey = "$_"' --lang typescript .

# Find unvalidated input usage
ast-grep run --pattern 'eval($_)' --lang javascript .
```

### Performance

- [ ] Are there any obvious performance issues?
- [ ] Are N+1 queries avoided?
- [ ] Is caching considered where appropriate?
- [ ] Are there unnecessary computations?
- [ ] Is memory usage reasonable?

**Find performance issues:**

```bash
# Find loops that might cause N+1 queries
ast-grep run --pattern 'for ($$$) { await $QUERY($$$) }' --lang typescript .
ast-grep run --pattern '$ARR.map(async ($ITEM) => { await $$$BODY })' --lang typescript .
```

### Test Coverage

- [ ] Are there sufficient tests?
- [ ] Do tests cover edge cases?
- [ ] Are tests testing behavior, not implementation?

**Check test coverage:**

```bash
# Find untested symbols
cm untested . --format ai

# Find tests for specific symbol
cm tests functionName . --format ai

# Run coverage report
vitest run --coverage
uv run pytest --cov=src --cov-report=term-missing
```

---

## Reviewing Pull Requests

### Using GitHub CLI

```bash
# List PRs needing review
gh pr list --search "review:required"

# View PR details
gh pr view 123

# View PR diff
gh pr diff 123

# Checkout PR locally for testing
gh pr checkout 123

# Check CI status
gh pr checks 123

# Approve PR
gh pr review 123 --approve

# Request changes
gh pr review 123 --request-changes --body "Please fix X"

# Add comment
gh pr review 123 --comment --body "Looks good, minor suggestion..."
```

### Review Workflow

```bash
# 1. Checkout the PR
gh pr checkout 123

# 2. Run tests
vitest run
# or
uv run pytest

# 3. Run linters
bunx eslint src/
# or
uv run ruff check .

# 4. Check for issues
bunx knip
npx jscpd src/
cm deps . --circular --format ai

# 5. Understand changes
cm map . --level 2 --format ai
gh pr diff 123

# 6. Submit review
gh pr review 123 --approve
# or
gh pr review 123 --request-changes --body "Comments"
```

---

## Review Best Practices

### For Reviewers

- Focus on the code, not the author
- Ask questions rather than make demands
- Explain the "why" behind suggestions
- Distinguish between blocking issues and nitpicks
- Acknowledge good solutions

**Use tools to support reviews:**

```bash
# Understand what changed
gh pr diff 123

# Trace impact of changes
cm callers changedFunction . --format ai

# Check if tests cover the changes
cm tests changedFunction . --format ai
```

### For Authors

- Keep PRs small and focused
- Provide context in PR description
- Respond to all comments
- Don't take feedback personally
- Ask for clarification when needed

**Before requesting review:**

```bash
# Run all checks
bunx tsc --noEmit && bunx eslint src/ && vitest run

# Self-review the diff
gh pr diff

# Check for common issues
bunx knip
npx jscpd src/
```

---

## Common Review Questions

**Architecture:**
- Does this belong in this module/layer?
- Are dependencies flowing in the right direction?
- Is this the right level of abstraction?

```bash
# Check module placement
cm deps ./src/module --format ai
cm deps . --circular --format ai
```

**Testing:**
- Are there sufficient tests?
- Do tests cover edge cases?
- Are tests testing behavior, not implementation?

```bash
# Find what's tested
cm tests functionName . --format ai
cm untested . --format ai
```

**Future-proofing:**
- Will this scale?
- Is this maintainable?
- Are we introducing technical debt?

```bash
# Check for duplication
npx jscpd src/

# Check complexity
cm callees complexFunction . --format ai
```

---

## Merging Pull Requests

```bash
# Merge with squash (recommended for feature branches)
gh pr merge 123 --squash

# Merge with rebase
gh pr merge 123 --rebase

# Standard merge commit
gh pr merge 123

# Delete branch after merge
gh pr merge 123 --squash --delete-branch
```

---

## Related Skills

- **gh**: Create PRs, review, merge with GitHub CLI
- **jujutsu**: Commit changes, rebase, manage history before PR
- **codemapper**: Understand code impact with `cm callers`, `cm deps`
- **knip**: Find unused code before review
- **jscpd**: Find duplicate code during review
- **ast-grep**: Search for patterns and potential issues
- **vitest**: Run tests as part of review
- **python**: pytest for Python project reviews
