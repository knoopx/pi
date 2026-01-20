# Vicinae UX Design Patterns

Based on established patterns from the Vicinae extensions codebase.

## List.Item Action Patterns

**✅ Actions directly on List.Item**:
```tsx
<List.Item
  title="Item Name"
  actions={
    <ActionPanel>
      <Action title="Primary Action" onAction={handlePrimary} />
      <Action title="Secondary Action" onAction={handleSecondary} />
    </ActionPanel>
  }
/>
```

**❌ Avoid selection-based conditional actions**:
```tsx
// Don't do this - creates confusing UX
<List>
  {items.map(item => (
    <List.Item title={item.name} onAction={() => setSelected(item)} />
  ))}
  <ActionPanel>
    {selected && <Action title="Action for selected" />}
  </ActionPanel>
</List>
```

## ActionPanel Organization

Group related actions in sections:
```tsx
<ActionPanel>
  <ActionPanel.Section>
    <Action title="Primary Action" />
    <Action title="Related Action" />
  </ActionPanel.Section>
  <ActionPanel.Section title="More Actions">
    <Action title="Secondary Action" />
  </ActionPanel.Section>
</ActionPanel>
```

## Navigation Patterns

```tsx
function ListView() {
  const { push, pop } = useNavigation();

  return (
    <List.Item
      title="Go to Detail"
      actions={
        <ActionPanel>
          <Action title="View Details" onAction={() => push(<DetailView />)} />
        </ActionPanel>
      }
    />
  );
}

function DetailView() {
  const { pop } = useNavigation();

  return (
    <Detail
      actions={
        <ActionPanel>
          <Action title="Back" onAction={pop} shortcut={{ modifiers: ["ctrl"], key: "[" }} />
        </ActionPanel>
      }
    />
  );
}
```

## Pattern Recommendations

| Use Case | Pattern |
|----------|---------|
| Simple actions | Direct actions on List.Item |
| State changes | Direct actions on List.Item |
| Complex workflows | Navigation to detail view |
| Quick actions | No-view commands |

## Anti-Patterns

- **Too many actions**: Aim for 2-6 actions per item, use sections
- **Inconsistent shortcuts**: Keep shortcuts consistent across similar actions
- **State-dependent UI**: Don't show/hide actions based on complex state
- **Over-reliance on onAction**: Choose either direct actions OR navigation
