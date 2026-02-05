---
description: Review Jujutsu changes for code quality, bugs, and improvements
---

Review Jujutsu changes for code quality, potential bugs, and improvements.

<workflow>
1. Review the diff (default: @):
   ```bash
   jj diff --git --color never -r <revision>
   ```

2. For context, check affected files:

   ```bash
   jj file list -r <revision>
   ```

3. Apply checklist, then provide structured feedback
   </workflow>

<checklist>
**Correctness**
- [ ] Does it work? Edge cases handled?
- [ ] Logic errors? Off-by-one?
- [ ] Error handling: fail fast, specific exceptions, context included?

**Design** (design, swe)

- [ ] SOLID: Single responsibility? Open/closed? Liskov? Interface segregation? Dependency inversion?
- [ ] DRY: Duplicated code? (use `jscpd`)
- [ ] KISS: Unnecessary complexity? Over-engineering?
- [ ] YAGNI: Features not yet needed?

**Types** (typescript, python)

- [ ] Type hints on all functions/parameters?
- [ ] Avoid `any` - use `unknown` or specific types?
- [ ] Type guards for narrowing?
- [ ] Invalid states unrepresentable?

**Readability**

- [ ] Self-documenting? (no unnecessary comments)
- [ ] Meaningful names? No abbreviations?
- [ ] Single abstraction level per function?
- [ ] 2-3 parameters max per function?

**Security** (design)

- [ ] Input validated at boundaries?
- [ ] Injection risks? (SQL, XSS, command)
- [ ] Secrets hardcoded?
- [ ] Auth/authz correct?

**Performance**

- [ ] N+1 queries?
- [ ] Unnecessary computations in loops?
- [ ] Memory leaks? Unbounded growth?

**Testing** (vitest, python)

- [ ] Sufficient coverage?
- [ ] Tests behavior, not implementation?
- [ ] Edge cases tested?
- [ ] Tests independent, deterministic, fast?
- [ ] BDD structure? (Given/When/Then)

**Code Smells** (swe)

- [ ] God class? → Split
- [ ] Feature envy? → Move method
- [ ] Long parameter list? → Parameter object
- [ ] Dead code? (use `knip`)

**Dependencies** (codemapper)

- [ ] Circular dependencies? (`cm deps . --circular`)
- [ ] Unused imports/deps? (`knip`)
      </checklist>

<tools>
```bash
# Duplicates
npx jscpd src/

# Unused code

bunx knip

# Circular deps

cm deps . --circular --format ai

# Type check

bunx tsc --noEmit # TS
uv run mypy src/ # Python

# Lint

bunx eslint src/ # TS
uv run ruff check . # Python

````
</tools>

<output-format>
## Review: `<revision>`
**Summary**: [What changed]

### Issues
- 🔴 [Critical - must fix]
- 🟡 [Warning - should address]

### Suggestions
- 💡 [Improvements]

**Verdict**: ✅ Approve | 🔄 Request changes | 💬 Discuss
</output-format>

<examples>
```bash
jj diff --git --color never -r @        # Current change
jj diff --git --color never -r abc123   # Specific revision
jj diff --git --color never -r main..@  # Range
````

</examples>
