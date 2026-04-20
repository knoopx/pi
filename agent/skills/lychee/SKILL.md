---
  name: lychee
  description: "Checks for broken links in documentation, websites, and codebases using lychee. Use when finding dead links, validating URLs in markdown files, or checking links in a project."
---

# Lychee

Fast, async link checker written in Rust. Finds broken URLs and mail addresses in Markdown, HTML, and other text formats.

## Workflow / Commands

**Run a full project check:**

```bash
lychee .                          # Recursively check all supported files; exit 0 = all OK, non-zero = failures
```

**Check a single file or directory:**

```bash
lychee README.md                  # Single file
lychee 'docs/**/*.md'             # Glob (must be quoted to prevent shell expansion)
lychee https://example.com        # Website URL
```

**CI-friendly output (no progress bar, exit code on failure):**

```bash
lychee --no-progress .
```

**Include mail addresses and fragment anchors in checks:**

```bash
lychee --include-mail --include-fragments .
```

**Exclude URLs or paths (regex patterns, repeatable):**

```bash
lychee --exclude '^https://github\.com/' \
       --exclude-path 'node_modules' \
       .
```

**Remap URL patterns (repeatable):**

```bash
lychee --remap 'https://old.com https://new.com' README.md
```

## Details

- **Configuration file**: create `lychee.toml` in the project root to persist settings (auto-loaded). Use `--config custom.toml` for a different file.
- **Caching** speeds up repeated checks: `lychee --cache .`. Limit age with `--max-cache-age 2d`.
- **Output formats**: `-f json . > report.json` (machine-readable), `-f markdown` (table), `-f detailed` (per-link summary, the default).
- **GitHub links** benefit from `GITHUB_TOKEN` env var to avoid rate limits.
- **Debugging**: `lychee --dump README.md` lists extracted links without checking; `lychee -vvv` shows retry details; `--suggest` proposes replacements via web archive.

## Constraints

- Glob patterns must be quoted to prevent shell expansion
- Exit code `0` means all links OK; non-zero means failures found (useful in CI)
- `--exclude-all-private` skips private IPs, link-local, and loopback addresses

See [deep reference](references/DEEP.md) for config file schema and advanced recipes.
