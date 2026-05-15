---
name: lychee
description: "Check for broken links with lychee — fast Rust link checker for Markdown, HTML, and codebases. Use when validating URLs or finding dead links."
token_cost: 130
keywords: ["lychee", "link", "broken", "dead", "url", "check"]
---

# Lychee

Fast link checker written in Rust. Finds broken URLs and mail addresses in Markdown, HTML, and other text formats.

## Basic Usage

Check an entire project:

```bash
lychee .                          # Recursively check all supported files
                                  # Exit 0 = all OK, non-zero = failures found
```

Check a single file or URL:

```bash
lychee README.md                  # Single file
lychee 'docs/**/*.md'             # Glob (quote to prevent shell expansion)
lychee https://example.com        # Website URL
```

## CI-Friendly Output

Disable the progress bar for scripts and CI:

```bash
lychee --no-progress .
```

## Configuration Options

Include mail addresses and fragment anchors:

```bash
lychee --include-mail --include-fragments .
```

Exclude URLs or paths (regex patterns, repeatable):

```bash
lychee --exclude '^https://github\.com/' \
       --exclude-path 'node_modules' \
       .
```

Remap URL patterns:

```bash
lychee --remap 'https://old.com https://new.com' README.md
```

## Debugging

- `lychee --dump README.md` — list extracted links without checking them
- `lychee -vvv` — verbose retry details
- `--suggest` — propose replacements via web archive

## Rules

- Set `GITHUB_TOKEN` env var to avoid GitHub rate limits
- Use `--exclude-all-private` to skip private IPs and loopback
- Create `lychee.toml` for persistent project settings
- Use `--cache .` for faster repeated checks
- Use `-f json` or `-f markdown` for structured output
