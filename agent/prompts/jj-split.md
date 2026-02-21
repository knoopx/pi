---
description: Split a Jujutsu change into semantically logical commits
args:
  revision:
    description: Change ID to split
    default: "@"
---

Split jujutsu change {{revision}} into semantically logical commits.

Use the **conventional-commits** skill for commit message format.

<workflow>
1. Analyze changed files:
   ```bash
   jj diff -r {{revision}} --name-only
   ```

2. Identify logical groupings by domain/purpose

3. Split iteratively:

   ```bash
   jj split -r {{revision}} "<file-pattern>" -m "type(scope): description"
   ```

4. Update remaining change description:
   ```bash
   jj desc -r {{revision}} -m "type(scope): description"
   ```
   </workflow>

<grouping-strategies>
- By feature/module (auth/, api/, db/)
- By change type (new files, modifications, deletions)
- By purpose (config, implementation, tests)
- By dependency (base changes first, dependent changes after)
</grouping-strategies>

<icons>
✨ feat | 🐛 fix | 📚 docs | 💄 style | ♻️ refactor | ⚡ perf | 🧪 test | 🔧 chore
</icons>
