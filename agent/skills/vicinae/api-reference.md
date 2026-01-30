# Vicinae API Reference

Most commonly used APIs from `@vicinae/api`.

## Core UI Components

### List

```tsx
<List isShowingDetail searchBarPlaceholder="Search...">
  <List.Section title="Section">
    <List.Item
      title="Item"
      subtitle="Optional"
      icon={Icon.Document}
      accessories={[{ text: "Info" }]}
      detail={<List.Item.Detail markdown="# Details" />}
      actions={<ActionPanel>...</ActionPanel>}
    />
  </List.Section>
</List>
```

### Detail

```tsx
<Detail
  markdown="# Title\n\nContent"
  metadata={
    <Detail.Metadata>
      <Detail.Metadata.Label title="Status" text="Active" />
      <Detail.Metadata.Link title="URL" target="https://..." text="Open" />
    </Detail.Metadata>
  }
  actions={<ActionPanel>...</ActionPanel>}
/>
```

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
</Form>
```

### Grid

```tsx
<Grid columns={4}>
  <Grid.Item
    title="Item"
    content={{ source: "image.png" }}
    actions={<ActionPanel>...</ActionPanel>}
  />
</Grid>
```

## Actions

```tsx
<ActionPanel>
  {/* Custom action */}
  <Action title="Do Something" onAction={handleAction} />

  {/* Built-in actions */}
  <Action.CopyToClipboard title="Copy" content={text} />
  <Action.OpenInBrowser title="Open" url="https://..." />
  <Action.Open title="Open File" target="/path/to/file" />
  <Action.SubmitForm title="Submit" onSubmit={handleSubmit} />
</ActionPanel>
```

## Utilities

### Feedback

```typescript
// Toast notifications
await showToast({ title: "Success", style: Toast.Style.Success });
await showToast({
  title: "Error",
  message: "Details",
  style: Toast.Style.Failure,
});

// HUD (brief overlay)
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
const app = await getFrontmostApplication(); // Get focused app
const selected = await getSelectedText(); // Get selected text
```

### Preferences

```typescript
interface Preferences {
  apiKey: string;
  theme: "dark" | "light";
}
const prefs = getPreferenceValues<Preferences>();
```

### Navigation

```typescript
const { push, pop } = useNavigation();
push(<NewView />);  // Navigate forward
pop();              // Navigate back
```

## Icons and Colors

```tsx
// Built-in icons
<List.Item icon={Icon.Star} />
<List.Item icon={Icon.Bluetooth} />

// Custom icon
<List.Item icon="custom-icon.png" />

// Colors
<List.Item icon={{ source: Icon.Circle, tintColor: Color.Green }} />
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
  getFrontmostApplication,
  getSelectedText,
} from "@vicinae/api";
```
