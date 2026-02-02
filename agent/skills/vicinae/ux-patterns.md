# Vicinae UX Design Patterns

## Action Placement

### Global Actions on List

Use `List.actions` for actions that apply globally (create, refresh):

```tsx
<List
  searchBarPlaceholder="Search items..."
  actions={
    <ActionPanel>
      <Action
        icon={Icon.Plus}
        title="Create New"
        onAction={handleCreate}
      />
      <Action
        icon={Icon.RotateClockwise}
        title="Refresh"
        shortcut={{ modifiers: ["ctrl"], key: "r" }}
        onAction={handleRefresh}
      />
    </ActionPanel>
  }
>
  {items.map((item) => (
    <List.Item key={item.id} title={item.name} />
  ))}
</List>
```

### Item-Specific Actions on List.Item

Use `List.Item.actions` for actions that operate on that specific item:

```tsx
<List.Item
  title={item.name}
  icon={Icon.Document}
  actions={
    <ActionPanel>
      <Action
        icon={Icon.Eye}
        title="View"
        onAction={() => push(<DetailView item={item} />)}
      />
      <Action
        icon={Icon.Trash}
        title="Delete"
        style={Action.Style.Destructive}
        onAction={() => deleteItem(item)}
      />
    </ActionPanel>
  }
/>
```

## Filtering with Dropdown

Use `List.Dropdown` as `searchBarAccessory` to filter by category:

```tsx
<List
  searchBarPlaceholder="Search items..."
  searchBarAccessory={
    categories.length > 1 ? (
      <List.Dropdown
        tooltip="Filter by Category"
        value={selectedCategory}
        onChange={setSelectedCategory}
      >
        <List.Dropdown.Item title="All" value="all" />
        {categories.map((cat) => (
          <List.Dropdown.Item key={cat} title={cat} value={cat} />
        ))}
      </List.Dropdown>
    ) : undefined
  }
>
```

**Key points:**
- Only show dropdown if more than 1 option
- Use `tooltip` to describe the filter

## Empty State

Use `List.EmptyView` for empty states. It supports its own `actions` prop:

```tsx
<List searchBarPlaceholder="Search items...">
  {items.length === 0 ? (
    <List.EmptyView
      title="No Items Found"
      description="Create your first item to get started"
      icon={Icon.BlankDocument}
      actions={
        <ActionPanel>
          <Action icon={Icon.Plus} title="Create Item" onAction={handleCreate} />
        </ActionPanel>
      }
    />
  ) : (
    items.map((item) => <List.Item ... />)
  )}
</List>
```

### EmptyView Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string?` | Main heading text |
| `description` | `string?` | Secondary description |
| `icon` | `ImageLike?` | Icon to display |
| `actions` | `ReactNode?` | ActionPanel for empty state |

**Note:** Never use a fake `List.Item` with "No Items" title - always use `List.EmptyView`.

## Section with Count

Show item count in section title:

```tsx
<List.Section title={`${filteredItems.length} items`}>
  {filteredItems.map((item) => ...)}
</List.Section>
```

## Action Icons

**Every Action MUST have an icon** - including built-in actions:

```tsx
<ActionPanel>
  <Action icon={Icon.Eye} title="View" onAction={handleView} />
  <Action.OpenInBrowser icon={Icon.Link} title="Open" url="https://..." />
  <Action.CopyToClipboard icon={Icon.CopyClipboard} title="Copy" content={text} />
</ActionPanel>
```

### Common Icon Mappings

| Action Type | Icon |
|-------------|------|
| Create/Add | `Icon.Plus` |
| Refresh | `Icon.RotateClockwise` |
| View/Open | `Icon.Eye` |
| Open URL | `Icon.Link` |
| Copy | `Icon.CopyClipboard` |
| Edit | `Icon.Pencil` |
| Delete/Remove | `Icon.Trash` |
| Download | `Icon.Download` |
| Star/Favorite | `Icon.Star` |
| Archive | `Icon.Tray` |
| Folder | `Icon.Folder` |
| Email | `Icon.Envelope` |
| Play/Start | `Icon.Play` |
| Stop | `Icon.Stop` |
| Pause | `Icon.Pause` |
| Restart | `Icon.ArrowClockwise` |

## Keyboard Shortcuts

**Most extensions don't use shortcuts at all.** Only add them for critical repeat actions.

If you do add shortcuts, use single-letter mnemonics with `ctrl`:

```tsx
shortcut={{ modifiers: ["ctrl"], key: "r" }}  // Refresh (most common)
shortcut={{ modifiers: ["ctrl"], key: "x" }}  // Delete/Remove
shortcut={{ modifiers: ["ctrl"], key: "s" }}  // Stop/Start
```

**When to add shortcuts:**
- Refresh action (if data can change)
- Destructive actions users might repeat (bulk delete)

**Don't add shortcuts for:**
- Navigation actions (View, Open)
- Copy actions
- Edit actions
- Most other actions

## Toggle Actions

Prefer single toggle actions over separate on/off:

```tsx
// ✅ Good
<Action
  icon={Icon.Star}
  title={isStarred ? "Unstar" : "Star"}
  onAction={() => toggleStar(item)}
/>

// ❌ Bad
<Action title="Star" onAction={() => star(item)} />
<Action title="Unstar" onAction={() => unstar(item)} />
```

## Anti-Patterns

### ❌ Fake List.Items for Actions

```tsx
// DON'T use List.Item to trigger actions
<List.Item title="Create New" icon={Icon.Plus} ... />
```

### ❌ Actions Without Icons

```tsx
// DON'T omit icons
<Action title="View" onAction={handleView} />
```

### ❌ tel: URLs on Linux

```tsx
// DON'T use tel: on Linux - use copy instead
<Action title="Call" onAction={() => open(`tel:${phone}`)} />

// DO this
<Action.CopyToClipboard icon={Icon.CopyClipboard} title="Copy Phone" content={phone} />
```

### ❌ Missing searchBarPlaceholder

```tsx
// DON'T omit searchBarPlaceholder
<List isLoading={isLoading}>

// DO add it
<List isLoading={isLoading} searchBarPlaceholder="Search items...">
```

### ❌ Overusing Shortcuts

```tsx
// DON'T add shortcuts to every action
<Action title="View" shortcut={{ modifiers: ["ctrl"], key: "v" }} />
<Action title="Edit" shortcut={{ modifiers: ["ctrl"], key: "e" }} />
<Action title="Copy" shortcut={{ modifiers: ["ctrl"], key: "c" }} />
<Action title="Delete" shortcut={{ modifiers: ["ctrl"], key: "d" }} />
// ... too many!

// DO add only essential shortcuts
<Action title="Refresh" shortcut={{ modifiers: ["ctrl"], key: "r" }} />
<Action title="Delete" shortcut={{ modifiers: ["ctrl"], key: "x" }} />
```

## ActionPanel Organization

Group related actions in sections:

```tsx
<ActionPanel>
  <ActionPanel.Section>
    <Action icon={Icon.Eye} title="View" />
    <Action.OpenInBrowser icon={Icon.Link} title="Open in Browser" />
  </ActionPanel.Section>
  <ActionPanel.Section title="Manage">
    <Action icon={Icon.Pencil} title="Edit" />
    <Action
      icon={Icon.Trash}
      title="Delete"
      style={Action.Style.Destructive}
      shortcut={{ modifiers: ["ctrl"], key: "x" }}
    />
  </ActionPanel.Section>
</ActionPanel>
```

## Best Practices

- **Every action needs an icon**: No exceptions
- **Always add searchBarPlaceholder**: Improves discoverability  
- **Shortcuts are optional**: Only for frequent actions (refresh, delete)
- **Use mnemonics**: r=refresh, x=delete, s=start/stop, c=copy
- **Toggle over pairs**: Single toggle instead of on/off actions
- **Destructive actions last**: Put delete/remove at the end
- **Use style={Action.Style.Destructive}**: For dangerous actions
