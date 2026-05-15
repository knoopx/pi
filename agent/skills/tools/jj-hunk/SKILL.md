---
name: jj-hunk
description: "Programmatic hunk selection for Jujutsu — split, commit, or squash specific hunks without interactive prompts. Use when making partial commits or selective squashes."
token_cost: 180
related: [jj-core, conventional-commits]
keywords: ["hunk", "split", "partial", "squash", "select", "jj"]
---

# jj-hunk

Programmatic hunk selection for Jujutsu. Split, commit, or squash specific hunks without interactive prompts.

## Basic Workflow

List available hunks, create a spec file, then apply:

```bash
# See what hunks exist
jj-hunk list
jj-hunk list --format text    # Human-readable output
jj-hunk list --files          # Files with hunk counts only

# Split changes using a spec file
jj-hunk split --spec-file /tmp/spec.yaml "feat: add feature A"

# Commit specific files, leave rest uncommitted
jj-hunk commit --spec-file /tmp/commit-spec.yaml "fix: handle edge case"

# Squash into parent
jj-hunk squash --spec-file /tmp/squash-spec.yaml
```

Targets any revision with `-r <rev>` (default is `@` for working copy). Read specs from stdin with `-`.

## Spec Format

YAML files control which hunks to keep or reset:

```yaml
files:
  src/main.rs:
    hunks: [0, "hunk-7c3d..."] # Select by index or stable id
  path/to/skip:
    action: reset # Discard all changes
default: reset # Unlisted files get this action
```

- `hunks: [indices|ids]` — select by 0-based index or stable id from `jj-hunk list`
- `ids: ["hunk-..."]` — select by id string (sha256-based, stable across runs)
- `action: keep` / `action: reset` — keep or discard all changes in a file
- `default` — action for unlisted files

Use `jj-hunk list --spec-template` to generate an ID-based starting spec. IDs are more reliable than indices since they're stable across runs.

## Example: Split by Hunk

```bash
# 1. List hunks
jj-hunk list --format text
# Output: M src/main.rs — hunk 0 insert hunk-abc123, hunk 1 insert hunk-def456

# 2. Create spec for first hunk only
cat > /tmp/split-spec.yaml << 'EOF'
files:
  src/main.rs:
    hunks: [0]
default: reset
EOF

# 3. Split — first hunk becomes commit A, rest stays in working copy
jj-hunk split --spec-file /tmp/split-spec.yaml "feat: add feature A"
```

## Example: Commit Subset of Changes

```bash
cat > /tmp/commit-spec.yaml << 'EOF'
files:
  src/fix.rs:
    action: keep
default: reset
EOF

jj-hunk commit --spec-file /tmp/commit-spec.yaml "fix: handle edge case"
```

## Tips

- IDs are stable (sha256-based), indices are not — prefer ids for reproducibility
- Use `--files` for a quick summary without full hunk details
- Read spec from stdin: `cat spec.yaml | jj-hunk commit - "message"`
- Use `-r <rev>` with split/squash to target any revision
