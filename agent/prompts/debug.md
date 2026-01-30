---
description: Debug an issue by analyzing symptoms and finding root cause
---

Debug the issue: $1

<analysis_workflow>
1. **Reproduce**: Confirm the issue can be reproduced
2. **Isolate**: Narrow down the scope
3. **Investigate**: Examine logs, state, and code paths
4. **Fix**: Apply targeted fix
5. **Verify**: Confirm fix resolves the issue
6. **Prevent**: Add tests to prevent regression
</analysis_workflow>

<investigation_commands>
```bash
# Search for relevant code
rg "$1" --type ts --type js

# Find function definitions
cm query "$1" . --format ai

# Trace call paths
cm callers "$1" . --format ai
cm callees "$1" . --format ai

# Check recent changes
jj log -r 'recent()' --no-graph
jj diff -r @-
```
</investigation_commands>

<common_causes>
| Symptom | Likely Causes |
|---------|---------------|
| Null/undefined error | Missing null check, async timing |
| Type error | Incorrect type assertion, schema mismatch |
| Performance issue | N+1 queries, missing memoization, memory leak |
| State inconsistency | Race condition, missing update |
| Auth failure | Token expiry, permission check, CORS |
</common_causes>

<checklist>
- [ ] Root cause identified (not just symptom)
- [ ] Fix is targeted and minimal
- [ ] No new issues introduced
- [ ] Test added to prevent regression
- [ ] Related code checked for similar issues
</checklist>

<additional_context>
$@
</additional_context>
