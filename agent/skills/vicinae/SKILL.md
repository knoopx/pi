---
name: vicinae
description: Builds Vicinae launcher extensions with TypeScript and React, defines commands, and creates List/Form/Detail views. Use when creating new extensions and implementing view/no-view commands.
---

# Vicinae Extensions

Extensions for the Vicinae launcher using TypeScript and React. Two command types: **view** commands display React UI, **no-view** commands execute actions without UI.

## Creating an Extension

Recommended: use Vicinae's built-in "Create Extension" command.

Manual setup:

```bash
mkdir my-extension && cd my-extension
npm init -y
npm install @vicinae/api typescript @types/react @types/node
mkdir src && touch src/command.tsx
```

## Manifest (package.json)

```json
{
  "name": "my-extension",
  "title": "My Extension",
  "version": "1.0.0",
  "commands": [
    {
      "name": "my-command",
      "title": "My Command",
      "description": "What this command does",
      "mode": "view"
    }
  ],
  "dependencies": { "@vicinae/api": "^0.8.2" }
}
```

## View Commands (src/command.tsx)

```tsx
import { List, ActionPanel, Action, Icon } from "@vicinae/api";

export default function MyCommand() {
  return (
    <List searchBarPlaceholder="Search items...">
      <List.Item
        title="Item"
        icon={Icon.Document}
        actions={
          <ActionPanel>
            <Action
              icon={Icon.Eye}
              title="View"
              onAction={() => console.log("viewed")}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
```

All actions must have an `icon` prop.

## No-View Commands (src/action.ts)

```typescript
import { showToast } from "@vicinae/api";

export default async function QuickAction() {
  await showToast({ title: "Done!" });
}
```

## Development Workflow

```bash
npm run build              # Production build
npx tsc --noEmit           # Type check

# Run dev server in tmux (creates session only if it doesn't exist)
tmux has -t vicinae-dev || tmux new-session -d -s vicinae-dev 'bunx vici develop'
tmux capture-pane -t vicinae-dev -p -S -   # Read logs
```

## Navigation & Preferences

Navigate between views with `useNavigation`:

```tsx
const { push, pop } = useNavigation();
<Action icon={Icon.Eye} title="View" onAction={() => push(<DetailView />)} />;
```

Define preferences in the manifest and access with `getPreferenceValues()`.

## References

See references/ for advanced UX patterns, full API reference, and keyboard shortcuts.
