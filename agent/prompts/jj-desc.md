---
description: Add or fix Jujutsu change descriptions to follow conventional commit format
---

Add or fix Jujutsu change descriptions so all mutable, non-empty changes follow conventional commit format.

Use the **conventional-commits** skill (Conventional Commits v1.0.0) for type/scope rules, breaking changes, footers, and examples.

<format>
`type(scope): <icon> short description`

Types: feat, fix, docs, style, refactor, perf, test, chore
</format>

<workflow>
1. Review mutable changes missing descriptions (excluding empty changes):
   ```bash
   jj log -r 'mutable() & description("") & ~empty()' --no-graph -T 'change_id ++ "\n"'
   ```

2. Review mutable changes with descriptions that may not match the format:

   ```bash
   jj log -r 'mutable() & ~description("") & ~empty()' --no-graph -T 'change_id ++ " " ++ description ++ "\n"'
   ```

3. For each revision that is missing a description or not following the format:
   - Review the files: `jj file list -r <revision>`
   - Review the diff: `jj diff --git --color never -r <revision>`
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
