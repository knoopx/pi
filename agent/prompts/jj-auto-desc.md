---
description: Update Jujutsu change descriptions to follow conventional commit format
---

Update Jujutsu change descriptions to follow conventional commit format.

<format>
`type(scope): <icon> short description`

Types: feat, fix, docs, style, refactor, perf, test, chore
</format>

<workflow>
1. Review mutable changes:
   ```bash
   jj log -r 'mutable()' --no-graph -T 'change_id ++ " " ++ description ++ "\n"'
   ```

2. For each revision not following the format:
   - Review the diff: `jj diff -r <revision>`
   - Update description: `jj desc -r <revision> -m "type(scope): icon description"`
</workflow>

<examples>
```bash
jj desc -r abc123 -m "fix(auth): 🐛 fixed session timeout handling"
jj desc -r def456 -m "feat(api): ✨ added rate limiting middleware"
jj desc -r ghi789 -m "refactor(db): ♻️ extracted query builder"
```
</examples>

<icons>
✨ feat | 🐛 fix | 📚 docs | 💄 style | ♻️ refactor | ⚡ perf | 🧪 test | 🔧 chore
</icons>
