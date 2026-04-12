---
name: sem
description: Semantic version control analysis. Use sem to understand actual code changes vs cosmetic/stylistic modifications, identify impacted entities, and review diffs at the semantic level.
---

# Semantic Version Control (sem)

Analyzes code changes at the semantic level, distinguishing between meaningful modifications and cosmetic/stylistic changes.

## Purpose

`sem` helps you understand **what actually changed** in your code, not just what lines were modified. It identifies:

- **Cosmetic changes** (`~`): Formatting, whitespace, style updates
- **Modified entities** (`∆`): Functions, classes, or code with actual behavioral changes
- **Added/removed entities** (`+`/`-`): New or deleted functions, classes, types

## Key Commands

| Command                       | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `sem diff <rev>`              | Show semantic diff of a revision                    |
| `sem diff <old>..<new>`       | Show semantic diff between two revisions            |
| `sem impact <entity>`         | Show impact of changing an entity (deps/dependents) |
| `sem impact <entity> --tests` | Show tests affected by entity changes               |
| `sem blame <file>`            | Show semantic blame — who modified each entity      |
| `sem log <entity>`            | Show evolution of an entity through history         |
| `sem entities <file>`         | List semantic entities (functions, classes, types)  |
| `sem context <entity>`        | Show token-budgeted context for an entity           |

## Workflow Integration

### Before Describing Commits

```bash
# Review changes semantically before writing commit message
sem diff HEAD~1

# Output example:
# ┌─ src/utils.ts ────────────────────────────────
# │
# │  ~ function   formatDate            [cosmetic]
# │  ∆ function   parseDate             [modified]
# │  + function   validateDate          [added]
# │
# └────────────────────────────────────────────────
# Summary: 3 modified across 1 file
```

Use this to write accurate commit descriptions:

- If all changes are `~` (cosmetic) → `style:` or `format:`
- If `∆` (modified) exists → describe the actual behavior change
- If `+` or `-` exists → describe additions/removals

### Jujutsu Workflow

**Critical: Get the correct git commit hash for the jj change**

```bash
# Step 1: Get the git commit hash for a jj change ID
# Use --no-graph to avoid printing existing descriptions
jj log -r <change-id> -T 'commit_id' --no-graph
# Example: jj log -r nlukrrtnmlnz -T 'commit_id' --no-graph
# Output: 45a1bf3ef4cb1c68828a08558583281f9c539751

# DO NOT run: jj log -r <change-id>
# This shows existing descriptions which may be wrong and will mislead you

# Step 2: Use that hash with sem (use --commit flag!)
sem diff --commit 45a1bf3ef4cb1c68828a08558583281f9c539751

# WRONG: This compares the wrong commits!
# sem diff <parent-hash>  # ❌ This shows parent's changes, not current!

# Correct: sem diff --commit <hash> shows changes IN that commit
# The --commit flag tells sem to compare the commit against its parent

# Step 3: Verify you have the right commit
jj show <change-id>  # Shows the actual diff for verification
jj diff --name-only -r <change-id>  # List files changed in this change

# Step 4: Write accurate commit description based on semantic changes
jj desc -r <change-id> -m "<type>(<scope>): <description>"
```

### Reviewing Large Diffs

```bash
# When a diff touches many files but sem shows few changes:
jj diff --name-only -r @-  # 80 files changed
sem diff HEAD~1            # Only 3 functions modified, 2 cosmetic

# Conclusion: Most changes are stylistic, focus description on that
```

## Understanding Output

### Change Markers

| Marker | Meaning                      | Commit Type                  |
| ------ | ---------------------------- | ---------------------------- |
| `~`    | Cosmetic change              | `style:`, `format:`          |
| `∆`    | Modified (behavioral change) | `feat:`, `fix:`, `refactor:` |
| `+`    | Added entity                 | `feat:`                      |
| `-`    | Removed entity               | `refactor:`, `chore:`        |

### Impact Analysis

```bash
# See what depends on a changed function
sem impact parseDate

# See tests that cover the change
sem impact parseDate --tests

# See transitive impact
sem impact parseDate --transitive
```

## Entity Types

`sem` recognizes:

- Functions and methods
- Classes and interfaces
- Type definitions
- Constants and variables
- Modules and exports

## Tips

- **Always use `sem` before describing commits** — it reveals the true scope of changes
- **Convert jj revisions to git hashes** — `sem` works with git commit IDs
- **Focus commit messages on `∆` changes** — cosmetic changes (`~`) are secondary
- **Use `sem impact`** to understand downstream effects before making changes
- **Large file counts don't always mean large changes** — `sem` reveals the truth

## Common Patterns

### Pattern 1: Style Refactoring

```bash
# 80 files changed, sem shows all cosmetic
sem diff HEAD~1
# ~ function foo [cosmetic]
# ~ function bar [cosmetic]

# Commit: "style: convert to one-liners"
```

### Pattern 2: Targeted Fix

```bash
# 5 files changed, sem shows 1 modified function
sem diff HEAD~1
# ~ function format [cosmetic]
# ∆ function validate [modified]

# Commit: "fix(validation): handle edge case in validate"
```

### Pattern 3: Feature Addition

```bash
# New functions added
sem diff HEAD~1
# + function newFeature [added]
# + function helper [added]

# Commit: "feat: add newFeature with helper"
```

## Related Skills

- **jujutsu**: Version control with jj
- **conventional-commits**: Write proper commit messages
- **review**: Code review before committing
