---
name: vhs
description: "Creates terminal screenshots and GIFs using VHS tape files. Use when automating terminal recordings, capturing TUI screenshots, or generating demo GIFs."
token_cost: 180
keywords: ["vhs", "screenshot", "gif", "terminal", "recording", "demo", "tape"]
---

# VHS

Terminal recorder from Charm that creates GIFs, PNGs, MP4s, and WebMs from scripted "tape" files. Run via `nix run nixpkgs#vhs -- <file>.tape`.

## Tape File Structure

A tape file is a sequence of commands that describe terminal interactions:

```tape
Output output.gif           # or .png, .mp4, .webm

Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 600
Set Theme "Catppuccin Mocha"

Hide                        # Hide typed commands from output
Type "echo hello"
Enter
Sleep 1s
Show                        # Show commands again
```

## Commands

- `Type "text"` — type text into the terminal
- `Enter`, `Tab`, `Escape`, `Space` — press keys
- `Ctrl+x`, `Alt+x` — key combinations
- `Up`, `Down`, `Left`, `Right` — arrow keys
- `Sleep 1s` — wait (supports `ms` and `s` units)
- `Screenshot file.png` — capture the current frame

## Settings

| Setting                        | Example           | Purpose                 |
| ------------------------------ | ----------------- | ----------------------- |
| `Set Shell "bash"`             | `Set Shell "zsh"` | Which shell to use      |
| `Set FontSize 14`              | `Set Width 1200`  | Terminal dimensions     |
| `Set Theme "Catppuccin Mocha"` | `Set Padding 20`  | Color theme and padding |
| `Set WindowBar Colorful`       | —                 | Window decorations      |

## Example: TUI Screenshot

```tape
Output screenshots/demo.png

Set Shell "bash"
Set FontSize 14
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"

Hide
Type "cd /path/to/project && my-tui-app"
Enter
Sleep 2s
Show

Ctrl+p
Sleep 1s
Screenshot screenshots/demo.png

Escape
Type "q"
Enter
```

## Tips

- Use `Hide`/`Show` to control whether typed commands appear in the output
- `Sleep` timing is critical — give apps time to render before capturing
- List available themes: `nix run nixpkgs#vhs -- themes`
