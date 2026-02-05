---
description: Add descriptions to Jujutsu changes that lack them
---

Add descriptions to Jujutsu changes that lack them, following conventional commit format.

Use the **conventional-commits** skill (Conventional Commits v1.0.0) for type/scope rules, breaking changes, footers, and examples.

<format>
`type(scope): <icon> short description`

Types: feat, fix, docs, style, refactor, perf, test, chore
</format>

<workflow>
1. Review mutable changes without descriptions:
   ```bash
   jj log -r 'mutable() & description("")' --no-graph -T 'change_id ++ "\n"'
   ```

2. For each revision without description:
   - Review the files: `jj file list -r <revision>`
   - Review the diff: `jj diff --git --color never -r <revision>`
   - Add description: `jj desc -r <revision> -m "type(scope): icon description"`
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
