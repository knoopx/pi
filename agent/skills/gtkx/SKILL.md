---
name: gtkx
description: "Build GTK4 desktop applications with the GTKX React framework, rendering JSX as native Linux widgets via a Rust FFI bridge. Use when creating GTK desktop apps, working with Adwaita/Libadwaita widgets, styling with CSS-in-JS, building virtual lists, or debugging GTKX component issues."
---

# GTKX

GTKX renders React components as native GTK4 widgets on Linux: `@gtkx/react` → FFI bridge → GTK4/GLib.

## Project Setup

```bash
npx @gtkx/cli@latest create my-app
# Runs: npm run dev | npm run build | npm test (vitest + Xvfb)
```

Generates `src/app.tsx`, `src/dev.tsx` (HMR), `src/index.tsx`. Entry calls `render(<App />, pkg.gtkx.appId)`.

## Essential Patterns

### Controlled Inputs

Widgets require explicit two-way binding — not React state alone:

```tsx
const [text, setText] = useState("");
<GtkEntry text={text} onChanged={(e) => setText(e.getText())} />;
// GtkSwitch: return true from onStateSet to accept change
```

### Compound Components (Slots)

Use compound components for child positioning — auto-generated from GIR:

```tsx
<AdwToolbarView>
  <AdwToolbarView.AddTopBar><AdwHeaderBar /></AdwToolbarView.AddTopBar>
</AdwToolbarView>

<GtkHeaderBar>
  <GtkHeaderBar.PackStart><GtkButton iconName="go-previous-symbolic" /></GtkHeaderBar.PackStart>
  <GtkHeaderBar.TitleWidget><GtkLabel label="Title" /></GtkHeaderBar.TitleWidget>
</GtkHeaderBar>
```

Common compound components: `AddTopBar`/`AddBottomBar` (ToolbarView), `PackStart`/`PackEnd` (HeaderBar/ActionBar), `StartChild`/`EndChild` (Paned/Flap).

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

### Styling with CSS-in-JS

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
```

## Key Constraints

- GTK is single-threaded — all widget operations on main thread
- Virtual list items must be stable objects (immutable data patterns)
- Use `quit` from `@gtkx/react` to close the application
- Async GTK uses Promise methods, catch `NativeError` for failures

## References

See references/ for full widget catalog, tutorials, FFI bindings, styling, portals, testing, and deployment.
