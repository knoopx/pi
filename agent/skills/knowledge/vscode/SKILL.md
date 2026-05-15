---
name: vscode
topic: VS Code Keybindings
description: "Visual Studio Code keyboard shortcuts and keybindings.json configuration. Use when looking up VS Code shortcuts or configuring custom keybindings."
token_cost: 160
keywords: ["vscode", "shortcut", "keybinding", "keyboard"]
---

# VS Code Keyboard Shortcuts

Reference for VS Code keybindings. macOS uses ⌘ (Command), ⌥ (Option), ⇧ (Shift), ⌃ (Control). Windows/Linux equivalents are noted.

## Essential Editing

| Action                           | macOS            | Windows/Linux                 |
| -------------------------------- | ---------------- | ----------------------------- |
| Cut/copy line (empty selection)  | ⌘X / ⌘C          | Ctrl+X / Ctrl+C               |
| Delete line                      | ⇧⌘K              | Ctrl+Shift+K                  |
| Insert line below/above          | ⌘Enter / ⇧⌘Enter | Ctrl+Enter / Ctrl+Shift+Enter |
| Move/copy line up/down           | ⌥↑↓ / ⇧⌥↑↓       | Alt+↑↓ / Shift+Alt+↑↓         |
| Add selection to next occurrence | ⌘D               | Ctrl+D                        |
| Select all occurrences           | ⇧⌘L              | Ctrl+Shift+L                  |
| Undo/Redo                        | ⌘Z / ⇧⌘Z         | Ctrl+Z / Ctrl+Y               |

## Navigation & Jumping

| Action                  | macOS    | Windows/Linux |
| ----------------------- | -------- | ------------- |
| Quick Open (go to file) | ⌘P       | Ctrl+P        |
| Go to line              | ⌃G       | Ctrl+G        |
| Go to symbol            | ⇧⌘O      | Ctrl+Shift+O  |
| Show All Symbols        | ⌘T       | Ctrl+T        |
| Go to definition        | F12      | F12           |
| Peek definition         | ⌥F12     | Alt+F12       |
| Rename symbol           | F2       | F2            |
| Go to next/prev error   | F8 / ⇧F8 | F8 / Shift+F8 |
| Quick Fix               | ⌘.       | Ctrl+.        |

## Find & Replace

| Action                           | macOS    | Windows/Linux   |
| -------------------------------- | -------- | --------------- |
| Find / Replace                   | ⌘F / ⌥⌘F | Ctrl+F / Ctrl+H |
| Select all matches               | ⌥Enter   | Alt+Enter       |
| Toggle regex / whole word / case | ⌥⌘R/W/C  | Alt+R/W/C       |

## Multi-Cursor Editing

| Action                       | macOS       | Windows/Linux             |
| ---------------------------- | ----------- | ------------------------- |
| Insert cursor below/above    | ⌥⌘↓ / ⌥⌘↑   | Ctrl+Alt+↓ / Ctrl+Alt+↑   |
| Insert cursor at end of line | ⇧⌥I         | Shift+Alt+I               |
| Expand/shrink selection      | ⌃⇧⌘→ / ⌃⇧⌘← | Shift+Alt+→ / Shift+Alt+← |

## Folding & Comments

| Action              | macOS     | Windows/Linux               |
| ------------------- | --------- | --------------------------- |
| Fold/unfold region  | ⌥⌘[ / ⌥⌘] | Ctrl+Shift+[ / Ctrl+Shift+] |
| Toggle line comment | ⌘/        | Ctrl+/                      |
| Format document     | ⇧⌥F       | Shift+Alt+F                 |

## Editor & Window Management

| Action                 | macOS      | Windows/Linux          |
| ---------------------- | ---------- | ---------------------- |
| Split editor           | ⌘\         | Ctrl+\                 |
| Focus editor group     | ⌘1/2/3     | Ctrl+1/2/3             |
| Move editor left/right | ⌘K ⇧⌘← / → | Ctrl+Shift+PageUp/Down |
| Close editor           | ⌘W         | Ctrl+W                 |

## Configuration

Open keybindings UI: `Ctrl/Cmd + K, Ctrl/Cmd + S`

Custom shortcut in `keybindings.json`:

```json
{
  "key": "ctrl+shift+u",
  "command": "editor.action.transformToUppercase",
  "when": "editorTextFocus"
}
```
