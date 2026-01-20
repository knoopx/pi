---
name: vicinae
description: Develop and manage Vicinae launcher extensions using TypeScript and React. Use when building extensions for the Vicinae launcher.
---

# Vicinae Extensions Skill

Develop and manage Vicinae launcher extensions using TypeScript and React.

Vicinae is a high-performance, native launcher for Linux — built with C++ and Qt. It ships with built-in modules and lets you build extensions using React and TypeScript, fully server-side — no browser or Electron needed.

Use this to:

- Create custom commands for the Vicinae launcher
- Build interactive UI views with React components
- Develop no-view commands for quick actions
- Manage extension development and building
- Integrate with external APIs and services
- Debug Raycast extensions in Vicinae

## Core Concepts

- **Extensions**: Packages that add new commands to the Vicinae launcher
- **Commands**: Individual actions that can be executed from the launcher search
- **View Commands**: Commands that display custom UI (React components) - mode: "view"
- **No-View Commands**: Commands that execute actions without UI - mode: "no-view"
- **Manifest**: Extension metadata and commands defined in `package.json`
- **API**: `@vicinae/api` package providing React components and utilities
- **Raycast Compatibility**: Vicinae can run most Raycast extensions

## Why TypeScript and React?

Vicinae uses TypeScript for its clean syntax, thriving ecosystem, and ability to interface with external APIs. React provides declarative UI code that's easier than imperative updates. Unlike traditional web development, there's **no browser** - it's pure JavaScript producing serialized UI trees rendered natively by Vicinae's C++ core.

## Creating Extensions

### Using Vicinae's Create Extension Command (Recommended)

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
├── package.json          # npm metadata and Vicinae manifest
├── tsconfig.json         # TypeScript configuration
├── src/
│   ├── command1.tsx      # View command components
│   ├── command2.ts       # No-view command logic
│   └── utils.ts          # Shared utilities
├── assets/               # Icons and other assets
├── node_modules/         # Dependencies (auto-generated)
├── package-lock.json     # Locked dependency versions
└── README.md             # Optional documentation
```

### Key Files

**package.json** (Manifest):

```json
{
  "name": "my-extension",
  "title": "My Extension",
  "description": "Description of what the extension does",
  "version": "1.0.0",
  "author": "Your Name",
  "license": "MIT",
  "icon": "extension_icon.webp",
  "categories": [],
  "commands": [
    {
      "name": "my-command",
      "title": "My Command",
      "subtitle": "Optional subtitle",
      "description": "What this command does",
      "mode": "view"
    }
  ],
  "preferences": [],
  "scripts": {
    "build": "vici build",
    "dev": "vici develop"
  },
  "dependencies": {
    "@vicinae/api": "^0.8.2"
  },
  "devDependencies": {
    "typescript": "^5.9.2"
  }
}
```

**src/command.tsx** (View Command):

```tsx
import { List, ActionPanel, Action, Icon } from "@vicinae/api";

export default function MyCommand() {
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

**src/command.ts** (No-View Command):

```typescript
import { showToast } from "@vicinae/api";

export default async function MyCommand() {
  await showToast({ title: "Action executed!" });
  // Perform action here
}
```

## Development Workflow

### Requirements

- NodeJS (>=20 recommended)
- npm or pnpm package manager
- Basic knowledge of TypeScript and React

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
# Start development server (Vicinae needs to be running)
npm run dev

# Or use CLI directly
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
    <List isShowingDetail searchBarPlaceholder={'Search fruits...'}>
      <List.Section title="Fruits">
        {items.map((fruit) => (
          <List.Item
            key={fruit}
            title={fruit}
            icon={Icon.Document}
            detail={<List.Item.Detail markdown={`# ${fruit}\n\nDescription of ${fruit}.`} />}
            actions={
              <ActionPanel>
                <Action
                  title="Select Fruit"
                  onAction={() => console.log(`Selected ${fruit}`)}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
```

### No-View Commands

No-view commands execute actions without displaying UI. They're useful for quick actions like opening URLs or running scripts.

**Example No-View Command**:

```typescript
import { showToast, open } from "@vicinae/api";

export default async function QuickAction() {
  await open("https://example.com");
  await showToast({ title: "Opened website!" });
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
      markdown="# Detail View\n\nThis is a detail view."
      actions={
        <ActionPanel>
          <Action title="Back" onAction={pop} />
        </ActionPanel>
      }
    />
  );
}

export default function MainView() {
  const { push } = useNavigation();

  return (
    <List>
      <List.Item
        title="Show Detail"
        actions={
          <ActionPanel>
            <Action title="Navigate" onAction={() => push(<DetailView />)} />
          </ActionPanel>
        }
      />
    </List>
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
      showToast({ title: "Form submitted!" });
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

```typescript
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
- Reference by relative path to assets directory
- Supported formats: PNG, JPG, SVG, WebP

## Configuration and Preferences

### Extension Preferences

Define preferences in the manifest's `preferences` array:

```json
{
  "preferences": [
    {
      "name": "apiKey",
      "title": "API Key",
      "description": "Your API key for the service",
      "type": "password",
      "required": true
    },
    {
      "name": "theme",
      "title": "Theme",
      "description": "Choose your preferred theme",
      "type": "dropdown",
      "default": "dark",
      "data": [
        { "title": "Dark", "value": "dark" },
        { "title": "Light", "value": "light" }
      ]
    }
  ]
}
```

Access preferences in code:

```typescript
import { getPreferenceValues } from "@vicinae/api";

const preferences = getPreferenceValues();
const apiKey = preferences.apiKey;
```

### Command Preferences

Define command-specific preferences in the command's preferences array within the manifest.

## Raycast Compatibility

Vicinae is compatible with most Raycast extensions. To debug Raycast extensions:

1. Clone the [Raycast extensions repository](https://github.com/raycast/extensions)
2. Navigate to the extension directory
3. Install dependencies and Vicinae API:
   ```bash
   npm install
   npm install --save-dev @vicinae/api
   ```
4. Run in development mode:
   ```bash
   npx vici develop
   ```

Note: Use `@raycast/api` imports in Raycast extensions, not `@vicinae/api`.

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

- **Extension not loading**: Check manifest syntax and command entrypoints
- **Type errors**: Run `npx tsc --noEmit` to check types
- **Missing dependencies**: Ensure all imports are installed
- **UI not updating**: Check for React key props on dynamic lists
- **Navigation errors**: Ensure no-view commands don't use navigation hooks

## UX Design Patterns

Based on studying the existing Vicinae extensions codebase, here are the established UX design patterns:

### **List.Item Action Patterns**

**✅ CORRECT: Actions Directly on List.Item**
```tsx
<List.Item
  title="Item Name"
  actions={
    <ActionPanel>
      <Action title="Primary Action" onAction={handlePrimary} />
      <Action title="Secondary Action" onAction={handleSecondary} />
      <Action title="Tertiary Action" onAction={handleTertiary} />
    </ActionPanel>
  }
/>
```
*This is the standard pattern used in extensions like Bluetooth, Arch Packages, Case Converter, and Floww*

**❌ AVOID: Selection-Based Conditional Actions**
```tsx
// Don't do this - creates confusing UX with state-dependent actions
<List>
  {items.map(item => (
    <List.Item title={item.name} onAction={() => setSelected(item)} />
  ))}
  <ActionPanel>
    {selected && <Action title="Action for selected item" />}
  </ActionPanel>
</List>
```

**✅ BETTER: Navigation-Based Actions (for complex workflows)**
```tsx
<List.Item
  title="Item Name"
  onAction={() => push(<DetailView item={item} />)}
/>
// DetailView contains ActionPanel with comprehensive actions
```

### **Observed Patterns from Extensions**

1. **Direct Actions on List.Items**: All studied extensions put ActionPanel directly on List.Item components
2. **Multiple Actions Per Row**: Common to have 2-6 actions per list item (Bluetooth: 5, Case Converter: 4, Floww: 4)
3. **Contextual Actions**: Actions are specific to each item (copy name, open URL, toggle state, etc.)
4. **Consistent Shortcuts**: Related actions use similar keyboard shortcuts across extensions
5. **Detail Views**: Complex actions often navigate to detail views with more comprehensive options
6. **ActionPanel Sections**: Related actions grouped in ActionPanel.Section components

### **ActionPanel Organization**

**✅ CORRECT: Group Related Actions**
```tsx
<ActionPanel>
  <ActionPanel.Section>
    <Action title="Primary Action" />
    <Action title="Related Action" />
  </ActionPanel.Section>
  <ActionPanel.Section title="More Actions">
    <Action title="Secondary Action" />
    <Action title="Utility Action" />
  </ActionPanel.Section>
</ActionPanel>
```

### **Navigation Patterns**

**✅ CORRECT: useNavigation Hook**
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
          <Action title="Primary Action" />
          <Action title="Secondary Action" />
        </ActionPanel>
      }
    />
  );
}
```

### **Common Anti-Patterns**

**❌ AVOID: Cluttered Action Panels**
- Don't put 8+ actions on a single List.Item (aim for 2-6 max)
- Group related actions in ActionPanel.Section components
- Consider navigation for workflows with many actions

**❌ AVOID: Inconsistent Shortcuts**
- Use standard shortcuts (Ctrl+C for copy, Ctrl+Enter for primary action)
- Keep shortcuts consistent across similar actions in your extension

**❌ AVOID: State-Based UI**
- Don't show/hide actions based on complex component state
- Keep actions static and predictable for each item type
- Use navigation for state-dependent workflows

**❌ AVOID: Over-Reliance on onAction**
- Don't use onAction for navigation when you also have actions in ActionPanel
- Choose one pattern: either direct actions OR navigation-based

### **Pattern Recommendations by Use Case**

| Use Case | Recommended Pattern | Example |
|----------|-------------------|---------|
| **Simple Actions** | Direct actions on List.Item | Copy to clipboard, Open URL |
| **State Changes** | Direct actions on List.Item | Toggle on/off, Connect/disconnect |
| **Complex Workflows** | Navigation to detail view | Edit forms, multi-step processes |
| **Context Menus** | Direct actions on List.Item | Delete, rename, duplicate |
| **Quick Actions** | No-view commands | Simple operations without UI |

## Keyboard Shortcuts

Vicinae extensions follow consistent keyboard shortcut patterns optimized for Linux systems. All shortcuts use `Ctrl` modifier instead of `Cmd` (which is macOS-specific).

### **Standard Shortcuts by Action Type**

#### **Primary Actions**
- **`Ctrl+Enter`**: Execute primary action (Connect, Apply, Select)
- **`Ctrl+Space`**: Toggle state (Enable/Disable, Show/Hide)
- **`Ctrl+Click`**: Alternative primary action

#### **Copy Operations**
- **`Ctrl+C`**: Copy primary content (name, URL, value)
- **`Ctrl+Shift+C`**: Copy secondary content (ID, path, details)

#### **Connection/Network Actions**
- **`Ctrl+C`**: Connect (Bluetooth, WiFi)
- **`Ctrl+D`**: Disconnect
- **`Ctrl+T`**: Trust/Connect (Bluetooth)
- **`Ctrl+F`**: Forget/Remove device
- **`Ctrl+S`**: Scan/Start scanning
- **`Ctrl+R`**: Refresh/Reload

#### **CRUD Operations**
- **`Ctrl+N`**: Create New (database, network, etc.)
- **`Ctrl+E`**: Edit/Modify
- **`Ctrl+Delete`**: Delete/Remove
- **`Ctrl+Shift+Delete`**: Reset/Delete ranking

#### **Navigation & UI**
- **`Ctrl+I`**: Toggle details view
- **`Ctrl+[`**: Go back (navigation)
- **`Ctrl+R`**: Refresh/Reload data

### **Common Shortcut Patterns from Extensions**

| Extension | Primary Actions | Copy Actions | Special Actions |
|-----------|----------------|--------------|----------------|
| **Bluetooth** | `Ctrl+C` (Connect), `Ctrl+D` (Disconnect) | `Ctrl+C` (MAC) | `Ctrl+T` (Trust), `Ctrl+F` (Forget), `Ctrl+S` (Scan), `Ctrl+R` (Refresh), `Ctrl+I` (Details) |
| **WiFi** | `Ctrl+Enter` (Connect), `Ctrl+D` (Disconnect) | `Ctrl+C` (SSID), `Ctrl+Shift+C` (BSSID) | `Ctrl+R` (Refresh) |
| **Port Killer** | - | `Ctrl+C` (Port) | `Ctrl+R` (Refresh) |
| **Floww** | `Ctrl+Enter` (Apply) | `Ctrl+C` (Name) | `Ctrl+V` (Validate), `Ctrl+F` (Finder) |
| **Mullvad** | `Ctrl+Enter` (Select) | - | `Ctrl+Shift+Delete` (Reset ranking) |
| **Arch Packages** | - | - | - |
| **Case Converter** | - | - | - |

### **Shortcut Guidelines**

#### **Modifier Key Usage**
- **`Ctrl`** - Primary modifier for Linux (never use `Cmd`)
- **`Ctrl+Shift`** - Secondary actions, destructive operations
- **`Ctrl+Alt`** - Advanced/developer actions (rare)

#### **Key Selection Best Practices**
- **`C`** - Copy operations (most common)
- **`Enter`** - Primary/execute actions
- **`R`** - Refresh/reload operations
- **`D`** - Delete/disconnect operations
- **`N`** - New/create operations
- **`E`** - Edit operations
- **`I`** - Information/details toggle
- **`S`** - Scan/search operations
- **`T`** - Trust/toggle operations
- **`F`** - Find/forget operations

#### **Consistency Rules**
1. **Same action, same shortcut** across extensions
2. **Copy operations always use `Ctrl+C`** (primary) and `Ctrl+Shift+C` (secondary)
3. **Refresh operations always use `Ctrl+R`**
4. **Primary actions use `Ctrl+Enter`**
5. **Navigation uses `Ctrl+[` (back) and `Ctrl+]` (forward)

#### **Avoid These Patterns**
- ❌ Using `Cmd` modifier (macOS only)
- ❌ Inconsistent shortcuts for similar actions
- ❌ Overloading single keys with too many modifiers
- ❌ Using function keys (F1-F12) without strong justification

### **Implementation Examples**

```tsx
// ✅ CORRECT: Linux-optimized shortcuts
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
  title="Refresh"
  shortcut={{ modifiers: ["ctrl"], key: "r" }}
  onAction={handleRefresh}
/>

// ❌ AVOID: Mac OS shortcuts
<Action
  title="Connect"
  shortcut={{ modifiers: ["cmd"], key: "c" }}  // Wrong modifier
  onAction={handleConnect}
/>
```

### **Testing Shortcuts**

When developing extensions, test shortcuts on Linux systems to ensure:
- Modifiers work correctly (`Ctrl` vs `Cmd`)
- Key combinations don't conflict with system shortcuts
- Shortcuts are discoverable and intuitive

## Most Used Vicinae APIs

Based on analyzing the existing Vicinae extensions codebase, here are the most commonly used APIs from `@vicinae/api`, organized by usage frequency and category:

### **Core UI Components (Used in 100% of extensions)**

#### **Essential Components**
- **`List`** - Primary component for displaying items in a searchable list
- **`ActionPanel`** - Container for actions associated with list items
- **`Action`** - Individual actions that can be triggered
- **`Icon`** - Icons for visual elements (built-in icons like `Icon.Bluetooth`, `Icon.Wifi`, etc.)

#### **Feedback & Notifications**
- **`showToast`** - Display temporary notifications to users
- **`Toast`** - Toast configuration object (`Toast.Style.Success`, `Toast.Style.Failure`)

#### **Colors & Theming**
- **`Color`** - Color constants for theming (`Color.Green`, `Color.Red`, `Color.Blue`, etc.)

### **Common Actions (Used in 90%+ of extensions)**

#### **Clipboard Operations**
- **`Action.CopyToClipboard`** - Copy text/data to clipboard
- **`Clipboard.copy()`** - Direct clipboard copying
- **`Clipboard.readText()`** - Read text from clipboard
- **`Clipboard.paste()`** - Paste clipboard content

#### **Browser & External Apps**
- **`Action.OpenInBrowser`** - Open URLs in browser
- **`Action.Open`** - Open files/URLs with system default application

#### **Vicinae Navigation**
- **`Action.Open`** with `target="vicinae://..."` - Navigate between Vicinae commands

### **Configuration & Preferences (Used in 70%+ of extensions)**

- **`getPreferenceValues()`** - Access user preferences defined in manifest
- **`Cache`** - Persistent storage for extension data

### **Window & Application Management (Used in 50%+ of extensions)**

- **`closeMainWindow()`** - Close the Vicinae launcher window
- **`popToRoot()`** - Navigate back to root view
- **`showHUD()`** - Display heads-up display notifications
- **`getFrontmostApplication()`** - Get currently focused application
- **`getSelectedText()`** - Get selected text from focused application

### **Advanced UI Components (Used in 40%+ of extensions)**

#### **Detail Views**
- **`List.Item.Detail`** - Rich detail view for list items
- **`Detail`** - Standalone detail view component

#### **Forms**
- **`Form`** - Form container component
- **`Form.TextField`** - Text input field
- **`Form.TextArea`** - Multi-line text input

#### **Navigation**
- **`useNavigation()`** - Hook for multi-view navigation
- **`useNavigation().push()`** - Navigate to new view
- **`useNavigation().pop()`** - Navigate back

#### **Metadata Display**
- **`List.Item.Detail.Metadata`** - Structured metadata display
- **`List.Item.Detail.Metadata.Label`** - Individual metadata labels

### **Advanced Features (Used in 20-40% of extensions)**

#### **Launch Context**
- **`LaunchProps`** - Access launch context and parameters

#### **Grid Layouts**
- **`Grid`** - Alternative grid-based layout

### **API Usage Patterns by Extension Category**

| Category | Most Used APIs | Example Extensions |
|----------|----------------|-------------------|
| **System Management** | `List`, `ActionPanel`, `Action`, `Icon`, `showToast`, `getPreferenceValues` | Bluetooth, WiFi, Port Killer |
| **Package Management** | `List`, `ActionPanel`, `Action.CopyToClipboard`, `Action.OpenInBrowser`, `List.Item.Detail` | Arch Packages, Flatpak |
| **Text Processing** | `Clipboard`, `getSelectedText`, `getFrontmostApplication`, `Cache`, `showHUD` | Case Converter, Spongebob Text |
| **Network/Connectivity** | `List`, `ActionPanel`, `Icon`, `Color`, `Action.OpenInBrowser` | Mullvad, WiFi Commander |
| **File Operations** | `List`, `ActionPanel`, `Action.Open`, `showToast` | Floww, Fuzzy Files |
| **Forms/Input** | `Form`, `Form.TextField`, `useNavigation`, `Action.SubmitForm` | WiFi Commander (connect forms) |

### **API Import Patterns**

Most extensions import from `@vicinae/api` at the top:

```typescript
// Common import pattern (80% of extensions)
import { Action, ActionPanel, Icon, List, showToast } from "@vicinae/api";

// Extended import pattern (60% of extensions)  
import { 
  Action, ActionPanel, Color, Icon, List, 
  showToast, Toast, getPreferenceValues 
} from "@vicinae/api";

// Full import pattern (complex extensions)
import {
  Action, ActionPanel, Application, Cache, Clipboard,
  closeMainWindow, Color, Detail, Form, getFrontmostApplication,
  getPreferenceValues, getSelectedText, Icon, LaunchProps,
  List, popToRoot, showHUD, showToast, Toast, useNavigation
} from "@vicinae/api";
```

### **Common API Combinations**

#### **Basic List with Actions (90% of extensions)**
```tsx
<List>
  <List.Item
    title="Item Name"
    actions={
      <ActionPanel>
        <Action title="Primary Action" onAction={handleAction} />
        <Action.CopyToClipboard title="Copy" content={item.value} />
      </ActionPanel>
    }
  />
</List>
```

#### **CRUD Operations (70% of extensions)**
```tsx
<ActionPanel>
  <Action title="Create" shortcut={{ modifiers: ["ctrl"], key: "n" }} />
  <Action title="Edit" shortcut={{ modifiers: ["ctrl"], key: "e" }} />
  <Action title="Delete" style="destructive" shortcut={{ modifiers: ["ctrl"], key: "delete" }} />
</ActionPanel>
```

#### **Detail Views with Metadata (40% of extensions)**
```tsx
<List.Item
  detail={
    <List.Item.Detail
      markdown="# Title\nContent"
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Status" text="Active" />
        </List.Item.Detail.Metadata>
      }
    />
  }
/>
```

## Related Skills

- **typescript**: Use TypeScript for developing Vicinae extensions with proper type safety and modern JavaScript features.
```