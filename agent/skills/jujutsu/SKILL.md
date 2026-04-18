---
name: jujutsu
description: Manages version control with Jujutsu (jj), including rebasing, conflict resolution, and Git interop. Use when tracking changes, navigating history, squashing/splitting commits, or pushing to Git remotes.
---

# Jujutsu

Git-compatible VCS focused on concurrent development and ease of use.

> ⚠️ **Not Git!** Jujutsu syntax differs from Git:
>
> - Parent: `@-` not `@~1` or `@^`
> - Grandparent: `@--` not `@~2`
> - Child: `@+` not `@~-1`
> - Use `jj log` not `jj changes`

> 🚨 **CRITICAL — NEVER USE `git` FOR MUTATIONS IN A JJ REPO!**
>
> In a colocated repo, `git` commands that create or modify commits (e.g. `git commit`, `git rebase`, `git cherry-pick`, `git merge`) will silently corrupt your history and **cause irreversible file loss**. The jj data model is fundamentally different — git has no concept of it.
>
> ✅ **Allowed** (read-only): `git log`, `git diff`, `git show`, `git blame`, `git grep`
> ❌ **Forbidden** (mutations): `git commit`, `git rebase`, `git cherry-pick`, `git merge`, `git reset --hard`, `git checkout` on tracked files, `git stash`

## Key Commands

| Command                    | Description                                  |
| -------------------------- | -------------------------------------------- |
| `jj st`                    | Show working copy status                     |
| `jj log`                   | Show change log                              |
| `jj diff`                  | Show changes in working copy                 |
| `jj new`                   | Create new change                            |
| `jj desc`                  | Edit change description                      |
| `jj squash`                | Move changes to parent                       |
| `jj split`                 | Split current change                         |
| `jj rebase -s src -d dest` | Rebase changes                               |
| `jj absorb`                | Move changes into stack of mutable revisions |
| `jj bisect`                | Find bad revision by bisection               |
| `jj fix`                   | Update files with formatting fixes           |
| `jj sign`                  | Cryptographically sign a revision            |
| `jj metaedit`              | Modify metadata without changing content     |

## Project Setup

```bash
jj git init              # Init in existing git repo
jj git init --colocate   # Side-by-side with git
```

## Basic Workflow

```bash
jj new                   # Create new change
jj desc -m "feat: add feature"  # Set description
jj log                   # View history
jj edit change-id        # Switch to change
jj new --before @        # Time travel (create before current)
jj edit @-               # Go to parent
```

## Time Travel

```bash
jj edit change-id        # Switch to specific change
jj next --edit           # Next child change
jj edit @-               # Parent change
jj new --before @ -m msg # Insert before current
```

## Merging & Rebasing

```bash
jj new x yz -m msg       # Merge changes
jj rebase -s src -d dest # Rebase source onto dest
jj abandon              # Delete current change
```

## Conflicts

```bash
jj resolve              # Interactive conflict resolution
# Edit files, then continue
```

## Revset Syntax

**Parent/child operators:**

| Syntax | Meaning          | Example              |
| ------ | ---------------- | -------------------- |
| `@-`   | Parent of @      | `jj diff -r @-`      |
| `@--`  | Grandparent      | `jj log -r @--`      |
| `x-`   | Parent of x      | `jj diff -r abc123-` |
| `@+`   | Child of @       | `jj log -r @+`       |
| `x::y` | x to y inclusive | `jj log -r main::@`  |
| `x..y` | x to y exclusive | `jj log -r main..@`  |
| `x\|y` | Union (or)       | `jj log -r 'a \| b'` |

**⚠️ Common mistakes:**

- ❌ `@~1` → ✅ `@-` (parent)
- ❌ `@^` → ✅ `@-` (parent)
- ❌ `@~-1` → ✅ `@+` (child)
- ❌ `jj changes` → ✅ `jj log` or `jj diff`
- ❌ `a,b,c` → ✅ `a | b | c` (union uses pipe, not comma)

**Functions:**

```bash
jj log -r 'heads(all())'        # All heads
jj log -r 'remote_bookmarks()..'  # Not on remote
jj log -r 'author(name)'        # By author
jj log -r 'description(regex)'  # By description
jj log -r 'mine()'              # My commits
jj log -r 'committer_date(after:"7 days ago")'  # Recent commits
jj log -r 'mine() & committer_date(after:"yesterday")'  # My recent
```

## Templates

```bash
jj log -T 'commit_id ++ "\n" ++ description'
```

## Git Interop

```bash
jj bookmark create main -r @  # Create bookmark
jj git push --bookmark main   # Push bookmark
jj git fetch                 # Fetch from remote
jj bookmark track main@origin # Track remote
```

## Advanced Commands

```bash
jj absorb               # Auto-move changes to relevant commits in stack
jj bisect start         # Start bisection
jj bisect good          # Mark current as good
jj bisect bad           # Mark current as bad
jj fix                  # Run configured formatters on files
jj sign -r @            # Sign current revision
jj metaedit -r @ -m "new message"  # Edit metadata only
```

## Git Equivalents

| Git command               | Jujutsu equivalent                                                       |
| ------------------------- | ------------------------------------------------------------------------ |
| `git show <rev>:<file>`   | `jj file show <file> -r <rev>`                                           |
| `git blame <file>`        | `jj file annotate <file>`                                                |
| `git diff <rev1> <rev2>`  | `jj diff --from <rev1> --to <rev2>`                                      |
| `git log -- <file>`       | `jj log -r 'files("path")'`                                              |
| `git grep <pattern>`      | `jj file search <pattern>`                                               |
| `git ls-tree -r <rev>`    | `jj file list -r <rev>`                                                  |
| `git stash`               | `jj new -p`                                                              |
| `git stash pop`           | `jj restore -s @- --to @` (manual approach)                              |
| `git checkout <file> @~1` | `jj file show <file> -r @~- > <file>`                                    |
| `git show <rev>`          | `jj diff -r <rev>`                                                       |
| `git log --oneline`       | `jj log --limit 20 -T 'commit_id.short() ++ " " ++ description ++ "\n"'` |
| `git log --stat`          | `jj log -T 'commit_id.short() ++ " " ++ diff.stat() ++ "\n"'`            |
| `git show --stat <rev>`   | `jj diff -r <rev> -T 'stat()'`                                           |
| `git tag <name> <rev>`    | `jj bookmark create <name> -r <rev>`                                     |
| `git branch <name> <rev>` | `jj bookmark create <name> -r <rev>`                                     |
| `git checkout -b <name>`  | `jj new <name>`                                                          |
| `git reset HEAD <file>`   | (no staging — use `jj split` or edit)                                    |
| `git rebase <upstream>`   | `jj rebase -d <upstream> -s ::@`                                         |

## Get Git Commit Hash from jj Change

Jujutsu has a human-readable **change ID** and a corresponding git **commit hash** (in colocated repos).

```bash
# Full commit hash for current change
git rev-parse @  # → d60f1caf1ebf96973c3decd939e3fdf5ee380dc0
jj log -T 'commit_id ++ "\n"' -r @

# Short commit hash
jj log -T 'commit_id.short() ++ "\n"' -r @

# Commit hash for any revision by change ID or revset
jj log -T 'change_id ++ " → " ++ commit_id ++ "\n"' -r 'change_id("uzwqqk")'
jj log -T 'commit_id ++ "\n"' -r '@-'

# Show both IDs together in log
jj log -T '{change_id} {commit_id}\n' --limit 5
```

## Tips

- No staging: changes are immediate
- Use conventional commits: `type(scope): desc`
- `jj undo` to revert operations
- `jj op log` to see operation history
- Bookmarks are like branches
- `jj absorb` is powerful for fixing up commits in a stack

## Related Skills

- **gh**: GitHub CLI for PRs and issues
- **review**: Code review before committing
