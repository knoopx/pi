# Vicinae Keyboard Shortcuts

Use `Ctrl` for common actions, `Shift` for destructive actions.

## Standard Shortcuts

### Common Actions

| Shortcut | Action  | Notes                |
| -------- | ------- | -------------------- |
| `Ctrl+R` | Refresh | Reload/refresh data  |
| `Ctrl+N` | New     | Create new item      |
| `Ctrl+E` | Edit    | Edit selected item   |
| `Ctrl+O` | Open    | Open in external app |
| `Ctrl+D` | Details | Toggle detail view   |

### Destructive Actions

| Shortcut       | Action        | Notes                 |
| -------------- | ------------- | --------------------- |
| `Shift+Delete` | Delete/Remove | Move to trash, remove |

### Navigation

| Shortcut | Action     |
| -------- | ---------- |
| `Ctrl+[` | Go back    |
| `Ctrl+]` | Go forward |

## Implementation

```tsx
// Refresh action
<Action
  title="Refresh"
  icon={Icon.RotateClockwise}
  shortcut={{ modifiers: ["ctrl"], key: "r" }}
  onAction={handleRefresh}
/>

// Delete action (destructive)
<Action
  title="Delete"
  icon={Icon.Trash}
  style={Action.Style.Destructive}
  shortcut={{ modifiers: ["shift"], key: "delete" }}
  onAction={handleDelete}
/>

// Create new
<Action
  title="Create Item"
  icon={Icon.Plus}
  shortcut={{ modifiers: ["ctrl"], key: "n" }}
  onAction={handleCreate}
/>

// Edit
<Action
  title="Edit"
  icon={Icon.Pencil}
  shortcut={{ modifiers: ["ctrl"], key: "e" }}
  onAction={handleEdit}
/>
```

## Guidelines

1. **Use `Ctrl` for common actions** - Refresh, New, Edit, Open
2. **Use `Shift+Delete` for destructive actions** - Clear, intentional deletion
3. **Keep shortcuts consistent** - Same action = same shortcut across extensions
4. **Mnemonics** - Use letter that matches action (R=Refresh, N=New, E=Edit)

## Modifier Reference

| Modifier | Usage                         |
| -------- | ----------------------------- |
| `ctrl`   | Common actions (refresh, new) |
| `shift`  | Destructive actions (delete)  |
| `alt`    | Secondary/alternate actions   |

## Anti-Patterns

❌ `Ctrl+Backspace` - Conflicts with text editing
❌ `Ctrl+C` - Conflicts with copy
❌ `Ctrl+V` - Conflicts with paste
❌ `Cmd+...` - Not available on Linux

✅ `Ctrl+R` - Refresh
✅ `Shift+Delete` - Clear delete intent
✅ `Ctrl+N` - New item
