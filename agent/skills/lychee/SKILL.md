---
name: lychee
description: "Checks for broken links in documentation, websites, and codebases using lychee. Use when finding dead links, validating URLs in markdown files, or checking links in a project."
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

## Tips

- Create `lychee.toml` in the project root for persistent settings
- Enable caching with `lychee --cache .` for faster repeated checks
- Set `GITHUB_TOKEN` env var to avoid GitHub rate limits
- Use `--exclude-all-private` to skip private IPs and loopback addresses
- Output formats: `-f json . > report.json`, `-f markdown` for tables
