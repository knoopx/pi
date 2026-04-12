# Vicinae API Reference

## Core UI Components

### List

```tsx
<List
  isLoading={isLoading}
  searchBarPlaceholder="Search items..."
  searchBarAccessory={
    <List.Dropdown tooltip="Filter" value={filter} onChange={setFilter}>
      <List.Dropdown.Item title="All" value="all" />
      <List.Dropdown.Item title="Active" value="active" />
    </List.Dropdown>
  }
  actions={
    <ActionPanel>
      <Action icon={Icon.Plus} title="Create" onAction={...} />
    </ActionPanel>
  }
>
  <List.Section title="Section">
    <List.Item
      title="Item"
      subtitle="Optional"
      icon={Icon.BlankDocument}
      accessories={[{ text: "Info" }, { icon: Icon.Star }]}
      actions={<ActionPanel>...</ActionPanel>}
    />
  </List.Section>
</List>
```

### List with Detail Panel (Master-Detail)

Use `isShowingDetail` to show item details in a side panel:

```tsx
<List
  isLoading={isLoading}
  isShowingDetail
  onSelectionChange={(id) => setSelectedId(id)}
  searchBarPlaceholder="Search..."
>
  {items.map((item) => (
    <List.Item
      key={item.id}
      id={item.id}
      title={item.name}
      detail={
        <List.Item.Detail
          isLoading={isLoadingDetail}
          markdown="# Optional markdown content"
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label title="Status" text="Active" />
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Link
                title="Website"
                text="example.com"
                target="https://example.com"
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={<ActionPanel>...</ActionPanel>}
    />
  ))}
</List>
```

**Note:** Use `onSelectionChange` to load detail data lazily when item is selected.

### List.EmptyView

```tsx
<List searchBarPlaceholder="Search items...">
  {items.length === 0 ? (
    <List.EmptyView
      title="No Items Found"
      description="Create your first item"
      icon={Icon.BlankDocument}
      actions={
        <ActionPanel>
          <Action icon={Icon.Plus} title="Create" onAction={handleCreate} />
        </ActionPanel>
      }
    />
  ) : (
    items.map((item) => <List.Item ... />)
  )}
</List>
```

### Detail

```tsx
<Detail
  navigationTitle="Item Name"
  markdown="# Title\n\nContent with **markdown** support"
  metadata={
    <Detail.Metadata>
      <Detail.Metadata.Label title="Status" text="Active" />
      <Detail.Metadata.Label
        title="Type"
        text={{ value: "Important", color: "#ef4444" }}
      />
      <Detail.Metadata.Separator />
      <Detail.Metadata.Link
        title="Website"
        text="example.com"
        target="https://example.com"
      />
      <Detail.Metadata.Separator />
      <Detail.Metadata.TagList title="Tags">
        <Detail.Metadata.TagList.Item text="Tag 1" color="#3b82f6" />
        <Detail.Metadata.TagList.Item text="Tag 2" color="#22c55e" />
      </Detail.Metadata.TagList>
    </Detail.Metadata>
  }
  actions={<ActionPanel>...</ActionPanel>}
/>
```

#### Detail.Metadata Components

| Component      | Props                     | Description          |
| -------------- | ------------------------- | -------------------- |
| `Label`        | `title`, `text`, `icon?`  | Key-value label      |
| `Link`         | `title`, `text`, `target` | Clickable link       |
| `Separator`    | (none)                    | Visual divider       |
| `TagList`      | `title`, `children`       | List of colored tags |
| `TagList.Item` | `text`, `color?`          | Individual tag       |

### Form

```tsx
<Form
  actions={
    <ActionPanel>
      <Action.SubmitForm
        title="Save"
        onSubmit={(values) => console.log(values)}
      />
    </ActionPanel>
  }
>
  <Form.TextField id="name" title="Name" />
  <Form.TextArea id="description" title="Description" />
  <Form.Dropdown id="type" title="Type">
    <Form.Dropdown.Item value="a" title="Option A" />
  </Form.Dropdown>
  <Form.Checkbox id="active" label="Active" />
  <Form.Description text="Helper text" />
</Form>
```

### Grid

```tsx
<Grid columns={4} searchBarPlaceholder="Search...">
  <Grid.Item
    title="Item"
    content={{ source: "image.png" }}
    actions={<ActionPanel>...</ActionPanel>}
  />
</Grid>
```

## Actions

**All actions MUST have an icon prop:**

```tsx
<ActionPanel>
  <ActionPanel.Section>
    <Action icon={Icon.Eye} title="View" onAction={handleAction} />
    <Action.OpenInBrowser icon={Icon.Link} title="Open" url="https://..." />
    <Action.CopyToClipboard
      icon={Icon.CopyClipboard}
      title="Copy"
      content={text}
    />
  </ActionPanel.Section>
  <ActionPanel.Section title="Manage">
    <Action
      icon={Icon.Trash}
      title="Delete"
      style={Action.Style.Destructive}
      shortcut={{ modifiers: ["ctrl"], key: "x" }}
      onAction={handleDelete}
    />
  </ActionPanel.Section>
</ActionPanel>
```

## Keyboard Shortcuts

**Most extensions don't use shortcuts.** Only add for critical actions like refresh:

```tsx
shortcut={{ modifiers: ["ctrl"], key: "r" }}  // Refresh
```

## Utilities

### Feedback

```typescript
await showToast({ title: "Success", style: Toast.Style.Success });
await showToast({
  title: "Error",
  message: "Details",
  style: Toast.Style.Failure,
});
await showHUD("Action completed");
```

### Clipboard

```typescript
await Clipboard.copy("text");
await Clipboard.paste("text");
const text = await Clipboard.readText();
```

### System

```typescript
await open("https://..."); // Open URL/file
await closeMainWindow(); // Close launcher
await popToRoot(); // Navigate to root
```

### Navigation

```typescript
const { push, pop } = useNavigation();
push(<NewView />);
pop();
```

## Icons

```tsx
Icon.Plus; // Create/Add
Icon.RotateClockwise; // Refresh
Icon.Eye; // View
Icon.Link; // Open URL
Icon.CopyClipboard; // Copy
Icon.Pencil; // Edit
Icon.Trash; // Delete
Icon.Download; // Download
Icon.Star; // Favorite
Icon.Tray; // Archive
Icon.Folder; // Folder
Icon.Envelope; // Email
Icon.CheckCircle; // Complete
Icon.Circle; // Incomplete
Icon.Play; // Start
Icon.Stop; // Stop
Icon.Pause; // Pause
Icon.ArrowClockwise; // Restart
Icon.BlankDocument; // File/Document
Icon.Person; // Contact
Icon.Calendar; // Calendar
Icon.BarChart; // Spreadsheet
Icon.Image; // Image
```

## Common Import Pattern

```typescript
import {
  List,
  Detail,
  Form,
  Grid,
  ActionPanel,
  Action,
  Icon,
  Color,
  showToast,
  Toast,
  showHUD,
  Clipboard,
  open,
  closeMainWindow,
  popToRoot,
  getPreferenceValues,
  useNavigation,
} from "@vicinae/api";
```

## Full Example

```tsx
import { useState, useEffect, useCallback } from "react";
import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  useNavigation,
} from "@vicinae/api";

interface Item {
  id: string;
  name: string;
  url: string;
}

export default function Command() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { push } = useNavigation();

  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true);
      // Load items...
      setItems([]);
    } catch (error) {
      showToast({ title: "Error", style: Toast.Style.Failure });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search items..."
      actions={
        <ActionPanel>
          <Action
            icon={Icon.Plus}
            title="Create"
            onAction={() => push(<CreateForm onComplete={loadItems} />)}
          />
          <Action
            icon={Icon.RotateClockwise}
            title="Refresh"
            shortcut={{ modifiers: ["ctrl"], key: "r" }}
            onAction={loadItems}
          />
        </ActionPanel>
      }
    >
      {items.map((item) => (
        <List.Item
          key={item.id}
          title={item.name}
          icon={Icon.BlankDocument}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <Action.OpenInBrowser
                  icon={Icon.Link}
                  title="Open"
                  url={item.url}
                />
                <Action.CopyToClipboard
                  icon={Icon.CopyClipboard}
                  title="Copy Link"
                  content={item.url}
                />
              </ActionPanel.Section>
              <ActionPanel.Section title="Manage">
                <Action
                  icon={Icon.Trash}
                  title="Delete"
                  style={Action.Style.Destructive}
                  onAction={() => {
                    // Delete item
                    loadItems();
                  }}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
```
