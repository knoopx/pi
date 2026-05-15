# CLI Quickstart

## Installation

```bash
# NPM
npm install --location=global @getgrit/cli

# Or installation script
curl -fsSL https://docs.grit.io/install | bash

# Initialize config and install supporting binaries (optional)
grit init
grit install
```

Opt out of telemetry: set `GRIT_TELEMETRY_DISABLED=true`.

## Core Commands

### `grit apply` — search or rewrite

```bash
# Search (find all matches)
grit apply '`console.log($_)`' ./src/

# Rewrite (modifies files in place)
grit apply '`console.log($msg)` => `winston.log($msg)`' ./src/

# Dry-run preview
grit apply --dry-run '`console.log($msg)` => `winston.log($msg)`' ./src/

# Run a pattern by name (from stdlib or .grit/patterns/)
grit apply no_console_log ./src/

# Interactive selection of changes
grit apply -i '`console.log($_)` => .' ./src/

# Pipe code from stdin
echo 'console.log(hello)' | grit apply '`hello`=>`goodbye`' file.js --stdin
```

**Common flags:** `--dry-run`, `--force` (override uncommitted changes), `--verbose`, `--limit N`, `--language <lang>` / `-l`, `--output compact|standard|none`, `--cache`, `--refresh-cache`.

### `grit check` — enforce patterns as lints

```bash
# Check current directory for violations
grit check ./src/

# Auto-fix violations
grit check --fix ./src/

# GitHub Actions output
grit check --github-actions
```

Patterns must have `level: error` or `level: warn` in config to trigger CI failure. Grit's CI is trend-aware — new failing patterns don't break the build; only regressions do.

### `grit list` — discover available patterns

```bash
# All patterns applicable to current directory
grit list

# Filter by language
grit list --language js

# Only local or user-defined patterns
grit list --source local
grit list --source user
```

### Other commands

| Command                                          | Purpose                                |
| ------------------------------------------------ | -------------------------------------- |
| `grit doctor`                                    | Diagnostic info about environment      |
| `grit version`                                   | CLI and agent versions                 |
| `grit format`                                    | Format grit files in place (`--write`) |
| `grit patterns test [--watch] [--filter <name>]` | Test defined patterns                  |
| `grit auth login/logout/get-token`               | Authentication for Grit Cloud          |

## Configuration

Grit config lives at `.grit/grit.yaml`:

```yaml
version: 0.0.2
patterns:
  - name: avoid_only
    level: error
    body: |
      `$testlike.only` => `$testlike` where {
        `$testlike` <: or { `describe`, `it`, `test` }
      }
    description: Remove .only from test files
  # Import a remote pattern
  - name: github.com/getgrit/stdlib#no_dead_code
    level: warn
```

All `.grit/patterns/*.md` and `.grit/patterns/*.grit` files are auto-imported. Use `.gritignore` to exclude paths (glob syntax, cascading like `.gitignore`).

Inline suppression: `// grit-ignore pattern_name: reason` on the line to suppress.
