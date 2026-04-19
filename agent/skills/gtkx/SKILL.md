---
name: gtkx
description: "Build GTK4 desktop applications with the GTKX React framework, rendering JSX as native Linux widgets via a Rust FFI bridge. Use when creating GTK desktop apps, working with Adwaita/Libadwaita widgets, styling with CSS-in-JS, building virtual lists, or debugging GTKX component issues."
---

# GTKX Skill

GTKX renders React components as native GTK4 widgets on Linux: `@gtkx/react` → `@gtkx/ffi` → `@gtkx/native` → GTK4/GLib.

## Project Setup

```bash
npx @gtkx/cli@latest create my-app
# Runs: npm run dev | npm run build | npm test (vitest + Xvfb)
```

Generates `src/app.tsx`, `src/dev.tsx` (HMR), `src/index.tsx`. Entry calls `render(<App />, pkg.gtkx.appId)`. See [getting-started](references/getting-started.md).

## Essential Patterns

### Controlled Input

Widgets require explicit two-way binding — not React state alone:

```tsx
const [text, setText] = useState("");
<GtkEntry text={text} onChanged={(e) => setText(e.getText())} />;
// GtkSwitch: return true from onStateSet to accept change
```

### Compound Components

Slots and child positioning use compound components (auto-generated from GIR):

```tsx
<AdwToolbarView>
  <AdwToolbarView.AddTopBar><AdwHeaderBar /></AdwToolbarView.AddTopBar>
</AdwToolbarView>

<GtkHeaderBar>
  <GtkHeaderBar.PackStart><GtkButton iconName="go-previous-symbolic" /></GtkHeaderBar.PackStart>
  <GtkHeaderBar.TitleWidget><GtkLabel label="Title" /></GtkHeaderBar.TitleWidget>
</GtkHeaderBar>
```

Common compound components: `AddTopBar`/`AddBottomBar` (ToolbarView), `PackStart`/`PackEnd` (HeaderBar/ActionBar), `StartChild`/`EndChild` (Paned/Flap). See [widgets](references/widgets.md) for the full catalog.

### Layout and Lists

`GtkBox` (linear), `GtkGrid` (`GtkGrid.Child`), `GtkStack` (`GtkStack.Page`), `GtkPaned` (`GtkPaned.StartChild`), `GtkScrolledWindow`. Virtual lists use `{ id, value }[]` items with `renderItem`; add `children` for tree mode. See [widgets](references/widgets.md).

### Styling and Portals

```tsx
import { css } from "@gtkx/css";
<GtkButton
  cssClasses={[
    css`
      background: #3584e4;
      &:hover {
        background: #1c71d8;
      }
    `,
  ]}
/>;

const win = useProperty(useApplication(), "activeWindow");
open && win && createPortal(<GtkAboutDialog programName="My App" />, win);
```

See [styling](references/styling.md) and [portals](references/portals.md).

### Adwaita Skeleton

```tsx
<AdwApplicationWindow
  title="App"
  defaultWidth={800}
  defaultHeight={600}
  onClose={quit}
>
  <AdwToolbarView>
    <AdwToolbarView.AddTopBar>
      <AdwHeaderBar>
        <GtkHeaderBar.PackStart>
          <GtkButton iconName="open-menu-symbolic" />
        </GtkHeaderBar.PackStart>
        <GtkHeaderBar.TitleWidget>
          <AdwWindowTitle title="App" />
        </GtkHeaderBar.TitleWidget>
      </AdwHeaderBar>
    </AdwToolbarView.AddTopBar>
    <MainContent />
  </AdwToolbarView>
</AdwApplicationWindow>
```

See [widgets](references/widgets.md), [examples](references/examples.md), and [tutorial](references/tutorial-window-and-header-bar.md).

## Key Constraints

- GTK is single-threaded — all widget operations on main thread
- Virtual list items must be stable objects (immutable data patterns)
- Use `quit` from `@gtkx/react` to close the application
- Async GTK uses Promise methods, catch `NativeError` for failures

## References

- **Widget API:** [widgets](references/widgets.md) · [examples](references/examples.md)
- **Core docs:** [introduction](references/introduction.md) · [getting-started](references/getting-started.md) · [ffi-bindings](references/ffi-bindings.md) · [styling](references/styling.md) · [portals](references/portals.md) · [testing](references/testing.md) · [cli](references/cli.md) · [mcp](references/mcp.md)
- **Tutorial:** [window & header bar](references/tutorial-window-and-header-bar.md) · [styling](references/tutorial-styling.md) · [lists & data](references/tutorial-lists-and-data.md) · [menus & shortcuts](references/tutorial-menus-and-shortcuts.md) · [navigation & split views](references/tutorial-navigation-and-split-views.md) · [dialogs & animations](references/tutorial-dialogs-and-animations.md) · [settings & preferences](references/tutorial-settings-and-preferences.md) · [deploying](references/tutorial-deploying.md)
