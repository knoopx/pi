---
name: jj-hunk
description: Programmatic hunk selection for jj (Jujutsu). Use when splitting commits, making partial commits, or selectively squashing changes without interactive UI.
---

# jj-hunk

Programmatic hunk selection for Jujutsu. Split, commit, or squash specific hunks without interactive prompts.

## Quick Start

```bash
# See what hunks exist in your changes
jj-hunk list

# See hunks for a specific revision (diff vs parent)
# Note: revset must resolve to a single revision
jj-hunk list --rev @

# List files only (hunk counts)
jj-hunk list --files

# Emit a spec template using stable ids
jj-hunk list --spec-template > /tmp/spec.yaml

# Split changes using a spec file
jj-hunk split --spec-file /tmp/spec.yaml "first commit"

# Split a specific revision (not just working copy)
jj-hunk split -r @- --spec-file /tmp/spec.yaml "first commit"

# Commit specific files, leave rest in working copy
jj-hunk commit --spec-file /tmp/spec.yaml "bug fix"

# Squash specific changes into parent
jj-hunk squash --spec-file /tmp/spec.yaml

# Read spec from stdin
cat spec.yaml | jj-hunk commit - "bug fix"
```

## Commands

| Command                                   | Description                          |
| ----------------------------------------- | ------------------------------------ |
| `jj-hunk list [options]`                  | List hunks, files, or spec templates |
| `jj-hunk split [-r rev] --spec-file <f>`  | Split changes into two commits       |
| `jj-hunk commit --spec-file <f>`          | Commit selected hunks                |
| `jj-hunk squash [-r rev] --spec-file <f>` | Squash selected hunks into parent    |

Split and squash accept `-r <rev>` to target any revision (default: `@`). Commit always operates on the working copy.

Use `--spec-file <path>` to read a YAML spec file, or `-` to read from stdin.

## List Options

| Option                                       | Description                              |
| -------------------------------------------- | ---------------------------------------- |
| `--rev <revset>`                             | Diff the revision against its parent     |
| `--format yaml\|text`                        | Output format (default: yaml)            |
| `--include <glob>` / `--exclude <glob>`      | Filter paths (repeatable, supports `**`) |
| `--group none\|directory\|extension\|status` | Group output                             |
| `--binary skip\|mark\|include`               | Binary handling (default: mark)          |
| `--max-bytes <n>` / `--max-lines <n>`        | Truncate before diffing                  |
| `--spec-file <path>`                         | Preview using a spec filter              |
| `--files`                                    | List files with hunk counts only         |
| `--spec-template`                            | Emit a spec template                     |

## Spec Format

Specs are written in YAML. Create spec files in `/tmp` or use stdin. You can select hunks by index (`hunks`) or by stable `ids` (sha256) emitted by `jj-hunk list`. IDs are emitted as `hunk-<sha256>`. `hunks` entries may also be id strings.

```yaml
files:
  path/to/file:
    hunks: [0, "hunk-7c3d...", 2]
  path/to/other:
    ids: ["hunk-9a2b..."]
  path/to/another:
    action: keep
  path/to/skip:
    action: reset
default: reset
```

- `hunks: [indices|ids]` — select by index (0-based) or id string
- `ids: ["hunk-..."]` — select hunks by id from `jj-hunk list`
- `action: keep` — keep all changes in file
- `action: reset` — discard all changes in file
- `default` — action for unlisted files (`keep` or `reset`)

`ids` and `hunks` are merged if both are provided. Use `jj-hunk list --spec-template` to generate an id-based starting spec.

## Example: Split by Hunk

**Scenario:** You have multiple changes in one commit. Split them logically.

```bash
# 1. See what hunks exist
jj-hunk list --format text
```

Output:

```
M src/main.rs
  hunk 0 insert hunk-abc123 (before 1+0 after 1+10)
  hunk 1 insert hunk-def456 (before 1+0 after 1+5)
M src/lib.rs
  hunk 0 insert hunk-789xyz (before 1+0 after 1+8)
```

```bash
# 2. Create spec file
cat > /tmp/split-spec.yaml << 'EOF'
files:
  src/main.rs:
    hunks: [0]
default: reset
EOF

# 3. Split: first hunk of main.rs → commit A, rest → commit B
jj-hunk split --spec-file /tmp/split-spec.yaml "feat: add feature A"

# 4. The remaining changes stay in working copy
jj diff --name-only
# src/main.rs (hunk 1), src/lib.rs
```

## Example: Split Multiple Files

```bash
# List hunks
jj-hunk list
```

```bash
# Create spec file
cat > /tmp/split-spec.yaml << 'EOF'
files:
  pkgs/new-tool.nix:
    action: keep
  modules/home-manager/packages/cli.nix:
    hunks: [0]
  flake.nix:
    hunks: [0]
default: reset
EOF

# Split using spec file
jj-hunk split --spec-file /tmp/split-spec.yaml "feat(cli): add new-tool"

# Or with revision flag
jj-hunk split -r @- --spec-file /tmp/split-spec.yaml "feat(cli): add new-tool"
```

## Example: Commit Subset of Changes

```bash
# Create spec file
cat > /tmp/commit-spec.yaml << 'EOF'
files:
  src/fix.rs:
    action: keep
default: reset
EOF

# Commit only the fix, leave experimental code uncommitted
jj-hunk commit --spec-file /tmp/commit-spec.yaml "fix: handle edge case"
```

## Example: Squash Specific Changes

```bash
# Create spec file
cat > /tmp/squash-spec.yaml << 'EOF'
files:
  src/cleanup.rs:
    action: keep
EOF

# Squash cleanup into parent commit
jj-hunk squash --spec-file /tmp/squash-spec.yaml
```

## Example: Filtering and Grouping

```bash
# Filter by path patterns
jj-hunk list --include 'src/**' --exclude '**/*.test.rs' --group directory

# Preview with a spec filter
cat > /tmp/preview-spec.yaml << 'EOF'
files:
  src/main.rs:
    action: keep
EOF

jj-hunk list --spec-file /tmp/preview-spec.yaml
```

## Tips

- Use `--spec-template` to generate an ID-based spec:
  ```bash
  jj-hunk list --spec-template > /tmp/spec.yaml
  ```
- IDs are stable (sha256-based), indices are not
- Use `--files` for a quick summary:
  ```bash
  jj-hunk list --files
  ```
- Read spec from stdin:
  ```bash
  cat spec.yaml | jj-hunk commit - "message"
  ```
- Use `-r <rev>` with split/squash to target any revision (default: `@`)
- Use `--group directory` to organize output by directory structure

## Related Skills

- **jujutsu**: General jj commands and workflows
- **conventional-commits**: Commit message format
