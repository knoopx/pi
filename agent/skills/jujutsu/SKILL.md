---
name: jujutsu
description: Manages version control with Jujutsu (jj), including rebasing, conflict resolution, and Git interop. Use when tracking changes, navigating history, squashing/splitting commits, or pushing to Git remotes.
---

# Jujutsu

Git-compatible VCS with a different data model — no staging area, changes are immediate. Every file is tracked in the working copy as "changes" (like commits without parents).

> ⚠️ **Never use `git` for mutations in a jj repo** — it corrupts history. Allowed: `git log`, `git diff`, `git show`, `git blame`, `git grep`.

## Basic Workflow

Create a change, describe it, view history:

```bash
jj new                   # Start a new change (like working on a commit)
jj desc -m "feat: add login"  # Write the message
jj log                   # View history — this is your main view command
jj diff                  # See what changed in working copy
```

Edit an existing change:

```bash
jj edit <change-id>      # Switch to a specific change
# Make changes to files...
jj squash                # Move new edits into the parent change
```

## Time Travel & Navigation

Jump to any point in history:

```bash
jj edit @-               # Go to parent
jj next --edit           # Go to child
jj edit <change-id>      # Jump to specific change
jj new --before @        # Insert a new change before current
```

## Squash & Split Changes

Combine changes into one:

```bash
# Merge two changes together
jj squash -m "combined message"

# Split working copy into separate commits
jj split                 # Interactive — pick hunks to commit separately
```

Auto-move changes to relevant commits in a stack:

```bash
jj absorb                # Smart squashing across mutable revisions
```

## Rebasing & Merging

Rebase changes onto another:

```bash
jj rebase -s @- -d main  # Rebase current change onto main
jj rebase -d main -s ::@ # Rebase all descendants of @ onto main
```

Merge two changes:

```bash
jj new x yz -m "merge"   # Create merge of x and yz
```

## Conflicts

Resolve interactively:

```bash
# Edit conflicted files, then continue
jj resolve
```

## Pushing to Git

Bookmarks are like branches. Track and push them:

```bash
jj bookmark create main -r @   # Create a bookmark at current change
jj git push --bookmark main    # Push that bookmark
jj git fetch                   # Fetch from remote
jj bookmark track main@origin  # Track a remote bookmark
```

## Useful Patterns

**Undo an operation:** `jj undo` — reverses the last jj command.

**Get git commit hash from jj change:**

```bash
jj log -T 'commit_id\n' -r @           # Full hash
jj log -T 'commit_id.short()\n' -r @   # Short hash
git rev-parse @                        # Also works in colocated repos
```

**Operation history:** `jj op log` — see all jj operations.

## Common Pitfalls

- ❌ Use `@~1` → ✅ Use `@-` (parent)
- ❌ Use `a,b,c` for union → ✅ Use `a | b | c` (pipe, not comma)
- ❌ Use `jj changes` → ✅ Use `jj log` or `jj diff`

## Related Skills

- **conventional-commits**: Commit message format
- **sem**: Semantic analysis before writing commit messages
