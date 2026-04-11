---
name: helix
description: "Configures and uses Helix, a post-modern modal text editor written in Rust. Use when editing files with Helix, configuring keybindings, setting up language servers, or customizing themes."
---

## Overview

Helix is a post-modern modal text editor featuring selection-first editing, multiple selections, and tree-sitter integration. It uses the `selection → action` model inspired by Kakoune.

### Core Concepts

- **Modes**: Normal (navigation/editing), Insert (typing), Select/extend (making selections)
- **Selection-first**: Select text first, then act on it (delete, yank, change)
- **Multiple selections**: Edit multiple locations simultaneously
- **Tree-sitter**: Syntax-aware navigation and textobjects

## Quick Reference

### Essential Commands

```toml
# config.toml example
theme = "onedark"

[editor]
line-number = "relative"
mouse = false
auto-format = true

[keys.normal]
C-s = ":w"  # Save file
g = { a = "code_action" }  # Minor mode: ga triggers code action
```

### Keybindings

| Mode   | Key       | Action                    |
| ------ | --------- | ------------------------- |
| Normal | `i`       | Insert before selection   |
| Normal | `v`       | Enter select mode         |
| Normal | `:`       | Command mode              |
| Normal | `Space`   | Space mode (pickers, LSP) |
| Normal | `d`       | Delete selection          |
| Normal | `y`       | Yank (copy) selection     |
| Normal | `p`/`P`   | Paste after/before        |
| Normal | `u`/`U`   | Undo/Redo                 |
| Normal | `/`       | Search forward            |
| Normal | `n`/`N`   | Next/Previous match       |
| Normal | `gd`      | Go to definition          |
| Normal | `]d`/`[d` | Next/Previous diagnostic  |

### Space Mode (LSP & Pickers)

Accessed via `Space` in normal mode:

| Key | Action                       |
| --- | ---------------------------- |
| `f` | File picker (workspace root) |
| `b` | Buffer picker                |
| `s` | Document symbol picker       |
| `d` | Document diagnostics         |
| `a` | Code action                  |
| `r` | Rename symbol                |
| `k` | Hover (documentation)        |
| `/` | Global search                |

## Configuration

### File Locations

- **Linux/Mac**: `~/.config/helix/config.toml`
- **Windows**: `%AppData%\helix\config.toml`
- **Project-local**: `.helix/config.toml` (merged with global)

### Language Configuration

Create `languages.toml` in config directory:

```toml
[[language]]
name = "rust"
language-servers = [{ name = "rust-analyzer", except-features = ["format"] }, "taplo"]

[language-server.rust-analyzer]
command = "rust-analyzer"
```

## Common Tasks

### Remapping Keys

```toml
[keys.normal]
jk = "normal_mode"  # Escape insert mode with jk
C-s = ":w"          # Save with Ctrl+S

[keys.insert.j]
k = "normal_mode"   # Minor mode: jk exits insert
```

### Textobjects (Tree-sitter)

- `ma` / `mi` - Select around/inside textobject
- `]f` / `[f` - Next/previous function
- `]d` / `[d` - Next/previous diagnostic

### Shell Integration

- `|` - Pipe selection through command
- `!` - Insert command output before selection
- `:pipe` - Typable command for piping

## See Also

- `references/keymap.md` - Complete keybinding reference
- `references/configuration.md` - Detailed configuration options
- `references/languages.md` - Language server setup
- `references/themes.md` - Creating custom themes
