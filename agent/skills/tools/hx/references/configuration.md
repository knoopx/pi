# Helix Configuration Reference

## Config File Locations

- **Global**: `~/.config/helix/config.toml` (Linux/Mac) or `%AppData%\helix\config.toml` (Windows)
- **Workspace**: `.helix/config.toml` (merged with global)
- **Custom**: `hx -c path/to/config.toml`

Reload with `:config-reload` or `pkill -USR1 hx` (Unix).

## Editor Configuration

### Core Settings

```toml
[editor]
scrolloff = 5                    # Lines of padding
mouse = true                     # Enable mouse
line-number = "relative"         # "absolute" or "relative"
cursorline = false              # Highlight cursor line
cursorcolumn = false            # Highlight cursor column
auto-format = true              # Format on save
idle-timeout = 250              # ms before idle triggers
completion-timeout = 250        # ms before completion popup
auto-completion = true          # Auto-popup completions
path-completion = true          # Filepath completion
true-color = false              # Force truecolor
undercurl = false               # Force undercurl
bufferline = "never"            # "always", "never", or "multiple"
color-modes = false             # Color mode indicator
text-width = 80                 # Max line length for :reflow
```

### Clipboard

```toml
[editor]
clipboard-provider = "auto"     # "auto", "pasteboard", "wayland", "x-clip", "x-sel", "termcode", "none"

# Custom command
[editor.clipboard-provider.custom]
yank = { command = "xclip", args = ["-selection", "clipboard", "-i"] }
paste = { command = "xclip", args = ["-selection", "clipboard", "-o"] }
```

### Statusline

```toml
[editor.statusline]
left = ["mode", "spinner", "file-name"]
center = []
right = ["diagnostics", "selections", "position", "file-encoding"]
separator = "│"
mode.normal = "NOR"
mode.insert = "INS"
mode.select = "SEL"
diagnostics = ["warning", "error"]
```

### LSP Settings

```toml
[editor.lsp]
enable = true
display-messages = true
display-progress-messages = false
auto-signature-help = true
display-inlay-hints = false
display-color-swatches = true
snippets = true
```

### Cursors

```toml
[editor.cursor-shape]
normal = "block"     # "block", "bar", "underline", "hidden"
insert = "bar"
select = "underline"
```

### File Picker

```toml
[editor.file-picker]
hidden = true               # Ignore hidden files
follow-symlinks = true
deduplicate-links = true
parents = true              # Read parent ignores
ignore = true               # Read .ignore
git-ignore = true           # Read .gitignore
git-global = true           # Global gitignore
git-exclude = true          # .git/info/exclude
max-depth = 10              # Max recursion depth
```

### Auto Pairs

```toml
[editor]
auto-pairs = true

# Custom pairs
[editor.auto-pairs]
'(' = ')'
'{' = '}'
'[' = ']'
'"' = '"'
'`' = '`'
'<' = '>'
```

### Auto Save

```toml
[editor.auto-save]
focus-lost = false              # Save on focus loss
after-delay.enable = false
after-delay.timeout = 3000      # ms
```

### Search

```toml
[editor.search]
smart-case = true             # Case-insensitive unless uppercase
wrap-around = true            # Wrap search
```

### Whitespace Rendering

```toml
[editor.whitespace]
render = "none"               # "all", "none", or table

# Per-character
[editor.whitespace.render]
space = "all"
tab = "all"
nbsp = "none"

[editor.whitespace.characters]
space = "·"
nbsp = "⍽"
tab = "→"
newline = "⏎"
tabpad = "·"
```

### Indent Guides

```toml
[editor.indent-guides]
render = true
character = "│"              # Try: "╎", "▏", "┆"
skip-levels = 0
```

### Gutters

```toml
[editor]
gutters = ["diagnostics", "spacer", "line-numbers", "spacer", "diff"]

# Custom
[editor.gutters]
layout = ["diff", "diagnostics", "line-numbers"]

[editor.gutters.line-numbers]
min-width = 3
```

### Soft Wrap

```toml
[editor.soft-wrap]
enable = true
max-wrap = 20                 # Free space at line end
max-indent-retain = 40        # Indent to retain
wrap-indicator = "↪"
wrap-at-text-width = false    # Wrap at text-width instead of viewport
```

### Smart Tab

```toml
[editor.smart-tab]
enable = true                 # Tab navigates syntax tree
supersede-menu = false        # Tab works even with completion menu
```

### Inline Diagnostics

```toml
[editor]
end-of-line-diagnostics = "hint"  # "error", "warning", "info", "hint", "disable"

[editor.inline-diagnostics]
cursor-line = "warning"     # Show warnings+errors on cursor line
other-lines = "disable"
prefix-len = 1
max-wrap = 20
max-diagnostics = 10
```

### Rulers

```toml
[editor]
rulers = [80, 120]          # Vertical lines at columns
```

## Typable Commands

Accessed via `:`:

| Command              | Description               |
| -------------------- | ------------------------- |
| `:w`, `:write`       | Write to disk             |
| `:w!`                | Force write               |
| `:q`, `:quit`        | Quit view                 |
| `:q!`                | Force quit                |
| `:wq`, `:x`          | Write and quit            |
| `:qa`, `:wqa`        | Quit all / Write quit all |
| `:cq`                | Quit with exit code       |
| `:o`, `:open`        | Open file                 |
| `:n`, `:new`         | New scratch buffer        |
| `:bc`                | Close buffer              |
| `:bn`, `:bp`         | Next/prev buffer          |
| `:cd`                | Change directory          |
| `:pwd`               | Show directory            |
| `:fmt`, `:format`    | Format file               |
| `:earlier`, `:later` | Time travel               |
| `:reload`            | Reload from disk          |
| `:lsp-restart`       | Restart LSP               |
| `:lsp-stop`          | Stop LSP                  |
| `:set-option`        | Set config                |
| `:toggle-option`     | Toggle config             |
| `:theme`             | Change theme              |
| `:sort`              | Sort selection            |
| `:reflow`            | Hard-wrap text            |
| `:pipe`, `:\|`       | Pipe to shell             |
| `:sh`                | Run shell command         |
| `:goto`, `:g`        | Goto line                 |
| `:lang`              | Set language              |
| `:echo`              | Print to statusline       |

## Command Line Expansions

| Expansion          | Description              |
| ------------------ | ------------------------ |
| `%{cursor_line}`   | Current line (1-indexed) |
| `%{cursor_column}` | Current column           |
| `%{buffer_name}`   | Current file path        |
| `%{language}`      | Current language         |
| `%{selection}`     | Selected text            |
| `%sh{cmd}`         | Shell command            |
| `%u{25CF}`         | Unicode char (●)         |

Double `%%` to escape.

## Remapping

```toml
[keys.normal]
jk = "normal_mode"              # Escape insert with jk
C-s = ":w"                      # Save
"C-S-esc" = "extend_line"       # Ctrl-Shift-Esc

# Minor mode
[keys.normal.g]
a = "code_action"               # ga triggers code action

# Macro
[keys.normal]
q = "@miw"                      # Select word macro
```

Special keys: `ret`, `esc`, `tab`, `backspace`, `space`, `left`, `right`, `up`, `down`, `home`, `end`, `pageup`, `pagedown`, `del`, `ins`.

Modifiers: `C-` (Ctrl), `A-` (Alt), `S-` (Shift), `Meta-`/`Cmd-`/`Win-` (Super).

Disable key: bind to `no_op`.
