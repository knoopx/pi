# Vicinae Keyboard Shortcuts

Linux-optimized shortcuts (use `Ctrl`, not `Cmd`).

## Standard Shortcuts

### Primary Actions
| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` | Execute primary action |
| `Ctrl+Space` | Toggle state |

### Copy Operations
| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Copy primary content |
| `Ctrl+Shift+C` | Copy secondary content |

### CRUD Operations
| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | Create new |
| `Ctrl+E` | Edit |
| `Ctrl+Delete` | Delete |

### Navigation
| Shortcut | Action |
|----------|--------|
| `Ctrl+[` | Go back |
| `Ctrl+]` | Go forward |
| `Ctrl+I` | Toggle details |
| `Ctrl+R` | Refresh |

### Connection/Network
| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Connect |
| `Ctrl+D` | Disconnect |
| `Ctrl+S` | Scan |
| `Ctrl+F` | Forget/Find |

## Implementation

```tsx
<Action
  title="Connect"
  shortcut={{ modifiers: ["ctrl"], key: "c" }}
  onAction={handleConnect}
/>

<Action
  title="Copy Name"
  shortcut={{ modifiers: ["ctrl"], key: "c" }}
  onAction={() => Clipboard.copy(name)}
/>

<Action
  title="Delete"
  shortcut={{ modifiers: ["ctrl"], key: "delete" }}
  style={Action.Style.Destructive}
  onAction={handleDelete}
/>
```

## Guidelines

- Use `Ctrl` modifier (never `Cmd`)
- Use `Ctrl+Shift` for secondary/destructive actions
- Keep shortcuts consistent across similar actions
- Don't conflict with system shortcuts
