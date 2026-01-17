---
name: vicinae
description: Develop and manage Vicinae launcher extensions using TypeScript and React.
---

# Vicinae Extensions Skill

Develop and manage Vicinae launcher extensions using TypeScript and React.

Use this to:
- Create custom commands for the Vicinae launcher
- Build interactive UI views with React components
- Develop no-view commands for quick actions
- Manage extension development and building
- Integrate with external APIs and services

Vicinae is an open-source launcher application that can be extended with custom commands written in TypeScript and React. Extensions provide additional functionality like application shortcuts, file search, clipboard management, and custom UI views.

## Core Concepts

- **Extensions**: Packages that add new commands to the Vicinae launcher
- **Commands**: Individual actions that can be executed from the launcher search
- **View Commands**: Commands that display custom UI (React components)
- **No-View Commands**: Commands that execute actions without UI
- **Manifest**: JSON file describing the extension and its commands
- **API**: `@vicinae/api` package providing React components and utilities

## Creating Extensions

### Using Vicinae's Create Extension Command

The easiest way to create a new extension is through Vicinae's built-in command:

1. Open Vicinae launcher
2. Search for "Create Extension"
3. Fill in the required fields:
   - Extension name
   - Author name
   - Description
4. Press `Shift + Enter` to create

This generates a complete extension template with all necessary files.

### Manual Creation

Alternatively, create extensions manually:

```bash
# Create extension directory
mkdir my-extension
cd my-extension

# Initialize npm project
npm init -y

# Install dependencies
npm install @vicinae/api typescript @types/react @types/node

# Create basic structure
mkdir src
touch src/index.ts
touch package.json
```

## Project Structure

A typical Vicinae extension has this structure:

```
my-extension/
├── package.json          # npm metadata and scripts
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── index.ts          # Main extension entry point
│   ├── command1.tsx      # View command components
│   ├── command2.ts       # No-view command logic
│   └── utils.ts          # Shared utilities
├── assets/               # Icons and other assets (optional)
└── extension.json        # Extension manifest
```

### Key Files

**extension.json** (Manifest):

```json
{
  "name": "my-extension",
  "title": "My Extension",
  "description": "Description of what the extension does",
  "version": "1.0.0",
  "author": "Your Name",
  "commands": [
    {
      "name": "my-command",
      "title": "My Command",
      "subtitle": "Optional subtitle",
      "description": "What this command does",
      "mode": "view"
    }
  ]
}
```

**src/index.ts** (Main entry point):

```typescript
import { ExtensionAPI } from "@vicinae/api";

export default function (api: ExtensionAPI) {
  // Register commands here
  api.registerCommand("my-command", {
    title: "My Command",
    description: "Command description",
    mode: "view",
    handler: () => {
      // Command logic
    },
  });
}
```

## Development Workflow

### Installing Dependencies

```bash
# Install all dependencies
npm install

# Install additional packages
npm install axios lodash
npm install -D @types/lodash
```

### Development Mode

```bash
# Start development server (requires Vicinae running)
npm run dev

# Or use the CLI directly
npx vici develop
```

In development mode:

- Extensions reload automatically on file changes
- Development React version is used
- Console logs appear in the terminal
- Commands show "(Dev)" suffix in the UI

### Building for Production

```bash
# Build the extension
npm run build

# Or use CLI
npx vici build

# Build to specific output directory
npx vici build -o dist/
```

### Type Checking

```bash
# Check TypeScript types
npx tsc --noEmit
```

## Command Types

### View Commands

View commands display custom UI using React components. They must return one of the supported root component types: `List`, `Grid`, `Detail`, or `Form`.

**Example View Command (src/my-list.tsx)**:

```tsx
import { List, ActionPanel, Action, Icon } from "@vicinae/api";

export default function MyList() {
  const items = ["Item 1", "Item 2", "Item 3"];

  return (
    <List>
      {items.map((item) => (
        <List.Item
          key={item}
          title={item}
          icon={Icon.Document}
          actions={
            <ActionPanel>
              <Action
                title="Select Item"
                onAction={() => console.log(`Selected ${item}`)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
```

### No-View Commands

No-view commands execute actions without displaying UI. They're useful for quick actions like opening URLs or running scripts.

**Example No-View Command**:

```typescript
import { showToast } from "@vicinae/api";

export default async function QuickAction() {
  await showToast({ title: "Action executed!" });
  // Perform action here
}
```

## Navigation and State Management

### Using Navigation Hook

For multi-view commands, use the `useNavigation` hook:

```tsx
import { List, Detail, useNavigation } from "@vicinae/api";

function ListView() {
  const { push } = useNavigation();

  return (
    <List>
      <List.Item
        title="Go to Detail"
        actions={
          <ActionPanel>
            <Action title="Show Detail" onAction={() => push(<DetailView />)} />
          </ActionPanel>
        }
      />
    </List>
  );
}

function DetailView() {
  const { pop } = useNavigation();

  return (
    <Detail
      markdown="# Detail View"
      actions={
        <ActionPanel>
          <Action title="Back" onAction={pop} />
        </ActionPanel>
      }
    />
  );
}
```

## Common Patterns

### API Calls

```typescript
import { useState, useEffect } from "react";
import { List, showToast } from "@vicinae/api";

function APIDataList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://api.example.com/data")
      .then(res => res.json())
      .then(setData)
      .catch(error => showToast({ title: "Error loading data", style: "failure" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <List isLoading />;

  return (
    <List>
      {data.map(item => (
        <List.Item key={item.id} title={item.name} />
      ))}
    </List>
  );
}
```

### Form Handling

```tsx
import { Form, ActionPanel, Action, useForm } from "@vicinae/api";

function MyForm() {
  const { handleSubmit, itemProps } = useForm({
    onSubmit: (values) => {
      console.log("Form submitted:", values);
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Name" {...itemProps.name} />
      <Form.TextArea title="Description" {...itemProps.description} />
    </Form>
  );
}
```

### Clipboard and System Integration

```tsx
import { Clipboard, showToast, open } from "@vicinae/api";

async function copyToClipboard(text: string) {
  await Clipboard.copy(text);
  await showToast({ title: "Copied to clipboard!" });
}

async function openInBrowser(url: string) {
  await open(url);
}
```

## Assets and Icons

### Using Icons

```tsx
import { Icon } from "@vicinae/api";

// Built-in icons
<List.Item icon={Icon.Star} title="Favorite" />

// Custom icons (place in assets/ directory)
<List.Item icon="icon.png" title="Custom Icon" />
```

### Asset Management

- Place images in `assets/` directory
- Reference by relative path
- Supported formats: PNG, JPG, SVG

## Configuration and Preferences

### Extension Preferences

```json
{
  "preferences": [
    {
      "name": "apiKey",
      "title": "API Key",
      "description": "Your API key for the service",
      "type": "password",
      "required": true
    }
  ]
}
```

Access preferences in code:

```typescript
const apiKey = api.preferences.apiKey;
```

## Publishing Extensions

### Building for Distribution

```bash
# Create production build
npm run build

# The build output can be shared or submitted to extension registries
```

### Extension Registry

Vicinae supports extension registries for easy installation. Submit your built extension to make it available to other users.

## Debugging

### Development Logs

- Use `console.log()` for debugging
- Logs appear in the terminal running `npm run dev`
- Use `showToast()` for user-visible messages

### Common Issues

- **Extension not loading**: Check manifest syntax and file paths
- **Type errors**: Run `npx tsc --noEmit` to check types
- **Missing dependencies**: Ensure all imports are installed
- **UI not updating**: Check for React key props on dynamic lists

## Best Practices

1. **Type Safety**: Use TypeScript for all extension code
2. **Error Handling**: Always wrap async operations in try-catch
3. **User Feedback**: Use `showToast()` for important messages
4. **Performance**: Avoid heavy computations in render functions
5. **Accessibility**: Provide clear titles and descriptions
6. **Testing**: Test extensions in development mode thoroughly
7. **Documentation**: Document complex commands in the manifest
8. **Versioning**: Follow semantic versioning for releases
9. **Dependencies**: Keep dependencies minimal and up-to-date
10. **User Experience**: Make commands discoverable with good titles

## Related Skills

- **typescript**: Essential for Vicinae extension development, providing type safety and modern JavaScript features.
- **bun**: Alternative package manager that works well with Vicinae extensions for faster dependency management.
- **react**: Core framework for building UI components in Vicinae extensions.
- **npm**: Package management for installing dependencies and running scripts.</content>
