---
name: jj-hunk
description: Programmatic hunk selection for jj (Jujutsu). Use when splitting commits, making partial commits, or selectively squashing changes without interactive UI.
---

# jj-hunk

Programmatic hunk selection for Jujutsu. Split, commit, or squash specific hunks without interactive prompts.

## Quick Start

```bash
# List hunks in current changes
jj-hunk list

# List hunks for a specific revision
jj-hunk list --rev @-

# Split hunks 0,1 of foo.rs into first commit, rest into second
jj-hunk split '{"files": {"src/foo.rs": {"hunks": [0, 1]}}, "default": "reset"}' "first commit"
```

## Commands

| Command                                   | Description                          |
| ----------------------------------------- | ------------------------------------ |
| `jj-hunk list [options]`                  | List hunks, files, or spec templates |
| `jj-hunk split [-r rev] <spec> <message>` | Split changes into two commits       |
| `jj-hunk commit <spec> <message>`         | Commit selected hunks                |
| `jj-hunk squash [-r rev] <spec>`          | Squash selected hunks into parent    |

## List Options

| Option                                  | Description                           |
| --------------------------------------- | ------------------------------------- |
| `--rev <revset>`                        | Diff revision against parent          |
| `--format json\|yaml\|text`             | Output format (default: json)         |
| `--include <glob>` / `--exclude <glob>` | Filter paths (repeatable)             |
| `--group none\|directory\|extension`    | Group output                          |
| `--files`                               | List files with hunk counts only      |
| `--spec-template`                       | Emit a spec template (JSON/YAML only) |

## Spec Format

Specs are JSON or YAML. Select hunks by index (0-based) or by stable `ids`.

```json
{
  "files": {
    "path/to/file": { "hunks": [0, 1] },
    "path/to/other": { "ids": ["hunk-9a2b..."] },
    "path/to/another": { "action": "keep" },
    "path/to/skip": { "action": "reset" }
  },
  "default": "reset"
}
```

| Action                  | Description                             |
| ----------------------- | --------------------------------------- |
| `{"hunks": [0, 1]}`     | Select by index (0-based)               |
| `{"ids": ["hunk-..."]}` | Select by stable ID from `jj-hunk list` |
| `{"action": "keep"}`    | Keep all changes in file                |
| `{"action": "reset"}`   | Discard all changes in file             |
| `"default"`             | Action for unlisted files               |

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
# 2. Split: first hunk of main.rs → commit A, rest → commit B
jj-hunk split '{"files": {"src/main.rs": {"hunks": [0]}}, "default": "reset"}' "feat: add feature A"

# 3. The remaining changes stay in working copy
jj diff --name-only
# src/main.rs (hunk 1), src/lib.rs
```

## Example: Split Multiple Files

```bash
# List hunks
jj-hunk list --format yaml
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
```

## Example: Commit Subset of Changes

```bash
# Commit only the fix, leave experimental code uncommitted
jj-hunk commit '{"files": {"src/fix.rs": {"action": "keep"}}, "default": "reset"}' "fix: handle edge case"
```

## Example: Squash Specific Changes

```bash
# Squash cleanup into parent commit
jj-hunk squash '{"files": {"src/cleanup.rs": {"action": "keep"}}, "default": "reset"}'
```

## Example: Split by File Pattern

```bash
# Commit all test files, keep source changes
jj-hunk commit '{"files": {}, "default": "reset"}' "test: add tests"
# Then filter with --include
jj-hunk list --include '**/*.test.rs' --format yaml
```

## Tips

- Use `--spec-template` to generate an ID-based spec:
  ```bash
  jj-hunk list --spec-template --format yaml > /tmp/spec.yaml
  ```
- IDs are stable (sha256-based), indices are not
- Use `--files` for a quick summary:
  ```bash
  jj-hunk list --files --format text
  ```
- Read spec from stdin:
  ```bash
  cat spec.json | jj-hunk commit - "message"
  ```

## Related Skills

- **jujutsu**: General jj commands and workflows
- **conventional-commits**: Commit message format
