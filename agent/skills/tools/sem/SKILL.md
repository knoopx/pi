---
name: sem
description: "Semantic version control analysis. Use sem to understand actual code changes vs cosmetic/stylistic modifications, identify impacted entities, and review diffs at the semantic level."
token_cost: 150
related: [jj-core, conventional-commits]
keywords: ["semantic", "diff", "change", "cosmetic", "impact", "review", "sem"]
---

# sem (Semantic Version Control)

Analyzes code changes at the semantic level — distinguishes meaningful behavioral modifications from cosmetic or stylistic changes.

## Key Commands

```bash
sem diff HEAD~1              # Show semantic diff of last commit
sem diff --commit <hash>     # Show changes in a specific git commit
sem impact parseDate         # See what depends on a changed function
sem impact parseDate --tests # See tests affected by entity changes
```

## Understanding Output

Changes are marked with symbols:

- `~` **cosmetic** — formatting, whitespace, style updates → `style:` or `format:` commit type
- `∆` **modified** — actual behavioral change → `feat:`, `fix:`, `refactor:`
- `+` **added** — new function, class, or type → `feat:`
- `-` **removed** — deleted entity → `refactor:`, `chore:`

## Typical Workflow with Jujutsu

When working with jj, convert change IDs to git commit hashes first:

```bash
# Step 1: Get the git commit hash for a jj change ID
jj log -r <change-id> -T 'commit_id' --no-graph
# Example: jj log -r nlukrrtnmlnz -T 'commit_id' --no-graph
# Output: 45a1bf3ef4cb1c68828a08558583281f9c539751

# Step 2: Use that hash with sem
sem diff --commit 45a1bf3ef4cb1c68828a08558583281f9c539751

# Step 3: Verify you have the right commit
jj show <change-id>
jj diff --name-only -r <change-id>

# Step 4: Write accurate commit description based on semantic changes
jj desc -r <change-id> -m "<type>(<scope>): <description>"
```

## When to Use sem

**Before describing commits:** Run `sem diff HEAD~1` to see the true scope of changes. If all changes are `~` (cosmetic), use `style:` or `format:`. If `∆` exists, describe the actual behavior change.

**Large diffs with few semantic changes:** A diff may touch 80 files but sem might show only 3 functions modified — most changes are stylistic. Focus your commit description on that.

## Tips

- Always use `sem` before writing commit messages — it reveals the true scope
- Convert jj revisions to git hashes with `jj log -r <change-id> -T 'commit_id' --no-graph`
- Use `sem impact` to understand downstream effects before making changes
- Large file counts don't always mean large semantic changes
