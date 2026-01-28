---
description: Update Jujutsu Change Description
---

- review jujutsu changes in the working directory with `jj log -r 'mutable()' --no-graph  -T 'change_id ++ " " ++ description ++ "\n"'`
- match revisions not following conventional commit format: `type(scope): <icon> short description`
- review the diffs and update description using `jj desc -r <revision id> -m "fix(module): 🐛 fixed memory leak"`
