---
name: helix
description: "Configures and uses Helix, a post-modern modal text editor written in Rust. Use when editing files with Helix, configuring keybindings, setting up language servers, or customizing themes."
---

# Helix

Modal text editor with selection-first editing and tree-sitter integration. The model is simple: select text first, then act on it (delete, yank, change). Supports multiple simultaneous selections.

## Modes & Navigation

- **Normal**: navigation and editing — `i` inserts before selection, `v` enters select mode
- **Insert**: typing mode — `jk` or `Escape` returns to Normal
- **Select/extend**: making multi-cursor selections

Key commands in Normal mode:

- `/` search forward, `n`/`N` next/previous match
- `gd` go to definition, `]d`/`[d` next/previous diagnostic
- `Space` opens Space mode (pickers, LSP actions)
- `ma`/`mi` select around/inside textobjects (tree-sitter aware)

## Space Mode (LSP & Pickers)

Accessed via `Space` in Normal mode:

- `f` file picker, `b` buffer picker, `s` document symbols
- `d` diagnostics, `a` code action, `r` rename, `k` hover docs
- `/` global search

## Configuration

Config lives in `~/.config/helix/config.toml` (global) or `.helix/config.toml` (project-local).

```toml
theme = "onedark"

[editor]
line-number = "relative"
mouse = false
auto-format = true

[keys.normal]
C-s = ":w"          # Save with Ctrl+S
g = { a = "code_action" }  # ga triggers code action

[keys.insert.j]
k = "normal_mode"   # jk escapes insert mode
```

## Language Servers

Configure in `languages.toml`:

```toml
[[language]]
name = "rust"
language-servers = [{ name = "rust-analyzer", except-features = ["format"] }, "taplo"]
```

## Shell Integration

Pipe selection through external commands or insert command output:

- `|` pipe selection through a command
- `!` insert command output before selection
- `:pipe` typable command for piping

## Key Constraints

- Selection-first editing — you must select text before acting on it
- Tree-sitter provides syntax-aware textobjects and navigation
- Project-local config merges with global config
