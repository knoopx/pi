---
description: Create a new feature following design and implementation best practices
---

Create a new feature: $1

<planning>
Before implementing, consider:
- [ ] Understand the requirements
- [ ] Identify edge cases
- [ ] Plan the approach
- [ ] Think about testing
- [ ] Consider security implications
</planning>

<design_principles>
- **SOLID**: Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion
- **KISS**: Keep it simple, prefer clarity over cleverness
- **YAGNI**: Don't build features until needed
- **DRY**: Extract common logic, but don't over-abstract
</design_principles>

<checklist>
- [ ] No debug code or console.log left
- [ ] No commented-out code
- [ ] Error handling is appropriate
- [ ] Tests cover new functionality
- [ ] No hardcoded secrets or credentials
- [ ] Changes are focused (single responsibility)
- [ ] Self-documenting code (no comments needed)
- [ ] Clear, descriptive naming
- [ ] Proper error handling
- [ ] Input validation
- [ ] Type safety
- [ ] Tests written
</checklist>

<workflow>
1. **Design**: Plan the approach and interfaces
2. **Implement**: Write the code following best practices
3. **Test**: Add comprehensive tests
4. **Review**: Self-review before committing
5. **Commit**: Use conventional commit format
</workflow>

<validation>
```bash
# Type check
bunx tsc --noEmit

# Lint
bunx eslint src/

# Test
bunx vitest run --coverage

# Format
bunx prettier --write "src/**/*.ts"
```
</validation>

<additional_context>
$@
</additional_context>
