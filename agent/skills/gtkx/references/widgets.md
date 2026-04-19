# Widget Reference

## Common Props (All Widgets)

| Prop                             | Type                                       | Description                    |
| -------------------------------- | ------------------------------------------ | ------------------------------ |
| `hexpand` / `vexpand`            | boolean                                    | Expand to fill available space |
| `halign` / `valign`              | `Gtk.Align.START \| CENTER \| END \| FILL` | Alignment                      |
| `marginStart/End/Top/Bottom`     | number                                     | Margins in pixels              |
| `sensitive`                      | boolean                                    | Enabled/disabled state         |
| `visible`                        | boolean                                    | Visibility                     |
| `cssClasses`                     | string[]                                   | CSS classes for styling        |
| `widthRequest` / `heightRequest` | number                                     | Minimum size                   |

---

## Containers

### GtkBox

Linear layout (horizontal or vertical).

```tsx
<GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
  {children}
</GtkBox>
```

### GtkGrid

2D grid with explicit positioning via `GtkGrid.Child`.

```tsx
<GtkGrid rowSpacing={8} columnSpacing={12}>
  <GtkGrid.Child column={0} row={0}>
    <GtkLabel label="Name:" />
  </GtkGrid.Child>
  <GtkGrid.Child column={1} row={0}>
    <GtkEntry hexpand />
  </GtkGrid.Child>
  <GtkGrid.Child column={0} row={1} columnSpan={2}>
    <GtkButton label="Submit" />
  </GtkGrid.Child>
</GtkGrid>
```

**Child props:** `column`, `row`, `columnSpan`, `rowSpan`

### GtkStack

Page container, shows one child at a time. Uses `GtkStack.Page` compound component.

```tsx
<GtkStack
  page="page1"
  transitionType={Gtk.StackTransitionType.SLIDE_LEFT_RIGHT}
>
  <GtkStack.Page id="page1" title="First" iconName="document-new">
    <Content1 />
  </GtkStack.Page>
  <GtkStack.Page id="page2" title="Second">
    <Content2 />
  </GtkStack.Page>
</GtkStack>
```

**Page props:** `id` (optional), `title`, `iconName`, `needsAttention`, `badgeNumber` (AdwViewStack only)

### GtkNotebook

Tabbed container with visible tabs. Uses `GtkNotebook.Page` and `GtkNotebook.PageTab`.

```tsx
<GtkNotebook>
  <GtkNotebook.Page label="Tab 1">
    <Content1 />
  </GtkNotebook.Page>
  <GtkNotebook.Page label="Tab 2" tabExpand tabFill>
    <Content2 />
  </GtkNotebook.Page>
</GtkNotebook>
```

Custom tab widget:

```tsx
<GtkNotebook.Page>
  <GtkNotebook.PageTab>
    <GtkBox spacing={4}>
      <GtkImage iconName="folder-symbolic" />
      <GtkLabel label="Files" />
    </GtkBox>
  </GtkNotebook.PageTab>
  <Content />
</GtkNotebook.Page>
```

**Page props:** `label`, `tabExpand`, `tabFill`

### GtkPaned

Resizable split with draggable divider. Uses `GtkPaned.StartChild` / `.EndChild`.

```tsx
<GtkPaned position={280} shrinkStartChild={false}>
  <GtkPaned.StartChild>
    <Sidebar />
  </GtkPaned.StartChild>
  <GtkPaned.EndChild>
    <MainContent />
  </GtkPaned.EndChild>
</GtkPaned>
```

### GtkOverlay

Stack widgets on top of each other. First child is base layer; additional children need `GtkOverlay.Child`.

```tsx
<GtkOverlay>
  <GtkButton label="Notifications" />
  <GtkOverlay.Child>
    <GtkLabel
      label="3"
      cssClasses={["badge"]}
      halign={Gtk.Align.END}
      valign={Gtk.Align.START}
    />
  </GtkOverlay.Child>
</GtkOverlay>
```

### GtkFixed

Absolute positioning with optional 3D transforms. Uses `GtkFixed.Child`.

```tsx
<GtkFixed>
  <GtkFixed.Child x={20} y={30}>
    <GtkLabel label="Top Left" />
  </GtkFixed.Child>
  <GtkFixed.Child x={200} y={100} transform={someGskTransform}>
    <GtkLabel label="Transformed" />
  </GtkFixed.Child>
</GtkFixed>
```

**Child props:** `x`, `y` (pixel coordinates), `transform` (optional `Gsk.Transform`)

### GtkScrolledWindow

Scrollable container.

```tsx
<GtkScrolledWindow vexpand hscrollbarPolicy={Gtk.PolicyType.NEVER}>
  <Content />
</GtkScrolledWindow>
```

---

## Virtual Lists

All virtual list widgets use an `items` data prop and a `renderItem` function. Items are `{ id: string, value: T }` objects.

### GtkListView

High-performance scrollable list with selection.

```tsx
<GtkListView
  estimatedItemHeight={48}
  vexpand
  selected={selectedId ? [selectedId] : []}
  selectionMode={Gtk.SelectionMode.SINGLE}
  onSelectionChanged={(ids) => setSelectedId(ids[0])}
  items={items.map((item) => ({ id: item.id, value: item }))}
  renderItem={(item: Item) => <GtkLabel label={item.name} />}
/>
```

### GtkGridView

Grid-based virtual scrolling.

```tsx
<GtkGridView
  estimatedItemHeight={100}
  minColumns={2}
  maxColumns={4}
  items={items.map((item) => ({ id: item.id, value: item }))}
  renderItem={(item: Item) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
      <GtkImage iconName={item.icon} />
      <GtkLabel label={item.name} />
    </GtkBox>
  )}
/>
```

### GtkColumnView

Table with sortable columns. Uses `GtkColumnView.Column`.

```tsx
<GtkColumnView
  estimatedRowHeight={48}
  sortColumn="name"
  sortOrder={Gtk.SortType.ASCENDING}
  onSortChanged={(col, order) => setSort(col, order)}
  items={items.map((item) => ({ id: item.id, value: item }))}
>
  <GtkColumnView.Column
    title="Name"
    id="name"
    expand
    resizable
    sortable
    renderCell={(item) => <GtkLabel label={item.name} />}
  />
  <GtkColumnView.Column
    title="Size"
    id="size"
    fixedWidth={100}
    sortable
    renderCell={(item) => <GtkLabel label={`${item.size} KB`} />}
  />
</GtkColumnView>
```

### GtkDropDown

Selection dropdown.

```tsx
<GtkDropDown
  selectedId={selectedId}
  onSelectionChanged={setSelectedId}
  items={options.map((o) => ({ id: o.id, value: o.label }))}
/>
```

### Tree Mode

Items with nested `children` arrays enable tree behavior in `GtkListView`.

```tsx
<GtkListView
  estimatedItemHeight={48}
  vexpand
  autoexpand={false}
  selected={selectedId ? [selectedId] : []}
  onSelectionChanged={(ids) => setSelectedId(ids[0])}
  items={files.map((file) => ({
    id: file.id,
    value: file,
    children: file.children?.map((c) => ({ id: c.id, value: c })),
  }))}
  renderItem={(item: FileNode) => (
    <GtkBox spacing={8}>
      <GtkImage
        iconName={
          item.isDirectory ? "folder-symbolic" : "text-x-generic-symbolic"
        }
      />
      <GtkLabel label={item.name} />
    </GtkBox>
  )}
/>
```

**Item props:** `id`, `value`, `children` (nested items for tree mode), `hideExpander`, `indentForDepth`, `indentForIcon`, `section` (for sectioned lists)

---

## Inputs

### GtkEntry

Single-line text input. **Requires two-way binding.**

```tsx
const [text, setText] = useState("");
<GtkEntry
  text={text}
  onChanged={(e) => setText(e.getText())}
  placeholderText="Enter text..."
/>;
```

### Toggle Buttons

```tsx
// Toggle button (auto-prevents signal loops)
<GtkToggleButton active={isActive} onToggled={() => setIsActive(!isActive)} label="Toggle" />

// Check button (checkbox)
<GtkCheckButton active={checked} onToggled={() => setChecked(!checked)} label="Option" />

// Switch (return true from onStateSet to accept change)
<GtkSwitch active={enabled} onStateSet={() => { setEnabled(!enabled); return true; }} />
```

### GtkSpinButton

Numeric input. Adjustment props are set directly.

```tsx
<GtkSpinButton
  value={count}
  lower={0}
  upper={100}
  stepIncrement={1}
  onValueChanged={setCount}
/>
```

### GtkScale

Slider with optional marks.

```tsx
<GtkScale
  drawValue
  valuePos={Gtk.PositionType.TOP}
  value={volume}
  lower={0}
  upper={100}
  stepIncrement={1}
  onValueChanged={setVolume}
  marks={[
    { value: 0, label: "Min", position: Gtk.PositionType.BOTTOM },
    { value: 50, position: Gtk.PositionType.BOTTOM },
    { value: 100, label: "Max", position: Gtk.PositionType.BOTTOM },
  ]}
/>
```

**Adjustment props:** `value`, `lower`, `upper`, `stepIncrement`, `pageIncrement`, `pageSize`, `onValueChanged`

### GtkCalendar

Date picker with markable days.

```tsx
<GtkCalendar
  onDaySelected={(cal) => setDate(cal.getDate())}
  markedDays={[15, 20, 25]}
/>
```

### GtkLevelBar

Progress/level indicator with customizable thresholds.

```tsx
<GtkLevelBar
  value={0.6}
  offsets={[
    { id: "low", value: 0.25 },
    { id: "high", value: 0.75 },
  ]}
/>
```

---

## Display

### GtkLabel

```tsx
<GtkLabel label="Text" halign={Gtk.Align.START} wrap useMarkup />
```

### GtkButton

```tsx
<GtkButton
  label="Click"
  onClicked={handleClick}
  iconName="document-new-symbolic"
/>
```

### GtkImage

```tsx
<GtkImage iconName="folder-symbolic" pixelSize={48} />
```

---

## Header & Action Bars

### GtkHeaderBar

Uses `GtkHeaderBar.PackStart`, `GtkHeaderBar.PackEnd`, and `GtkHeaderBar.TitleWidget`.

```tsx
<GtkHeaderBar>
  <GtkHeaderBar.PackStart>
    <GtkButton iconName="go-previous-symbolic" />
  </GtkHeaderBar.PackStart>
  <GtkHeaderBar.TitleWidget>
    <GtkLabel label="Title" cssClasses={["title"]} />
  </GtkHeaderBar.TitleWidget>
  <GtkHeaderBar.PackEnd>
    <GtkMenuButton iconName="open-menu-symbolic" />
  </GtkHeaderBar.PackEnd>
</GtkHeaderBar>
```

### GtkActionBar

Bottom action bar. Uses `GtkActionBar.PackStart` / `.PackEnd`.

```tsx
<GtkActionBar>
  <GtkActionBar.PackStart>
    <GtkButton label="Cancel" />
  </GtkActionBar.PackStart>
  <GtkActionBar.PackEnd>
    <GtkButton label="Save" cssClasses={["suggested-action"]} />
  </GtkActionBar.PackEnd>
</GtkActionBar>
```

---

## Menus

### GtkPopoverMenu with GtkMenuButton

```tsx
<GtkMenuButton iconName="open-menu-symbolic">
  <GtkMenuButton.MenuSection>
    <GtkMenuButton.MenuItem
      id="new"
      label="New"
      onActivate={handleNew}
      accels="<Control>n"
    />
    <GtkMenuButton.MenuItem id="open" label="Open" onActivate={handleOpen} />
  </GtkMenuButton.MenuSection>
  <GtkMenuButton.MenuSection>
    <GtkMenuButton.MenuSubmenu label="Export">
      <GtkMenuButton.MenuItem id="pdf" label="PDF" onActivate={exportPdf} />
      <GtkMenuButton.MenuItem id="csv" label="CSV" onActivate={exportCsv} />
    </GtkMenuButton.MenuSubmenu>
  </GtkMenuButton.MenuSection>
  <GtkMenuButton.MenuSection>
    <GtkMenuButton.MenuItem
      id="quit"
      label="Quit"
      onActivate={quit}
      accels="<Control>q"
    />
  </GtkMenuButton.MenuSection>
</GtkMenuButton>
```

**MenuItem props:** `id` (required), `label`, `onActivate`, `accels` (e.g., `"<Control>n"`)

---

## Windows

### GtkApplicationWindow

```tsx
<GtkApplicationWindow
  title="App"
  defaultWidth={800}
  defaultHeight={600}
  onClose={quit}
>
  <Content />
</GtkApplicationWindow>
```

Custom titlebar:

```tsx
<GtkApplicationWindow ...>
  <GtkWindow.TitleWidget><GtkHeaderBar /></GtkWindow.TitleWidget>
  <Content />
</GtkApplicationWindow>
```

---

## Adwaita (Libadwaita)

Import: `import * as Adw from "@gtkx/ffi/adw";`

### AdwApplicationWindow + AdwToolbarView

Modern app structure. Uses `AdwToolbarView.AddTopBar` / `.AddBottomBar`.

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
          <AdwWindowTitle title="App" subtitle="Description" />
        </GtkHeaderBar.TitleWidget>
      </AdwHeaderBar>
    </AdwToolbarView.AddTopBar>
    <MainContent />
    <AdwToolbarView.AddBottomBar>
      <GtkActionBar />
    </AdwToolbarView.AddBottomBar>
  </AdwToolbarView>
</AdwApplicationWindow>
```

### AdwStatusPage

Welcome, error, or empty state.

```tsx
<AdwStatusPage
  iconName="applications-system-symbolic"
  title="Welcome"
  description="Get started"
  vexpand
>
  <GtkButton
    label="Start"
    cssClasses={["suggested-action", "pill"]}
    halign={Gtk.Align.CENTER}
  />
</AdwStatusPage>
```

### AdwBanner

Dismissable notification.

```tsx
<AdwBanner
  title="Update available"
  buttonLabel="Dismiss"
  revealed={show}
  onButtonClicked={() => setShow(false)}
/>
```

### AdwPreferencesPage / AdwPreferencesGroup

Settings UI.

```tsx
<AdwPreferencesPage title="Settings">
  <AdwPreferencesGroup title="Appearance" description="Customize look">
    <AdwSwitchRow
      title="Dark Mode"
      active={dark}
      onActivated={() => setDark(!dark)}
    />
    <AdwActionRow title="Theme" subtitle="Select color">
      <AdwActionRow.AddPrefix>
        <GtkImage iconName="preferences-color-symbolic" />
      </AdwActionRow.AddPrefix>
      <AdwActionRow.AddSuffix>
        <GtkImage iconName="go-next-symbolic" valign={Gtk.Align.CENTER} />
      </AdwActionRow.AddSuffix>
    </AdwActionRow>
  </AdwPreferencesGroup>
</AdwPreferencesPage>
```

**ActionRow children:** `AdwActionRow.AddPrefix` for left widgets, `AdwActionRow.AddSuffix` for right widgets, or `ActivatableWidget` for clickable suffix.

### AdwExpanderRow

Expandable settings row. Uses `AdwExpanderRow.AddRow` / `.AddAction`.

```tsx
<AdwExpanderRow title="Advanced" subtitle="More options">
  <AdwExpanderRow.AddAction>
    <GtkButton iconName="emblem-system-symbolic" cssClasses={["flat"]} />
  </AdwExpanderRow.AddAction>
  <AdwExpanderRow.AddRow>
    <AdwSwitchRow title="Option 1" active />
    <AdwSwitchRow title="Option 2" />
  </AdwExpanderRow.AddRow>
</AdwExpanderRow>
```

### AdwEntryRow / AdwPasswordEntryRow

Input in list row.

```tsx
<AdwEntryRow title="Username" text={username} onChanged={(e) => setUsername(e.getText())} />
<AdwPasswordEntryRow title="Password" />
```

### AdwToggleGroup

Segmented button group for mutually exclusive options. Uses `x.Toggle` virtual element.

```tsx
const [mode, setMode] = useState("list");
<AdwToggleGroup
  activeName={mode}
  onActiveChanged={(_index, name) => setMode(name ?? "list")}
>
  <x.Toggle id="list" iconName="view-list-symbolic" tooltip="List view" />
  <x.Toggle id="grid" iconName="view-grid-symbolic" tooltip="Grid view" />
  <x.Toggle id="flow" label="Flow" />
</AdwToggleGroup>;
```

**Toggle props:** `id` (optional), `label`, `iconName`, `tooltip`, `enabled`

### AdwNavigationView

Stack-based navigation with history. Uses `AdwNavigationView.Page`.

```tsx
const [history, setHistory] = useState(["home"]);
<AdwNavigationView history={history} onHistoryChanged={setHistory}>
  <AdwNavigationView.Page id="home" title="Home">
    <GtkButton
      label="Go to Details"
      onClicked={() => setHistory([...history, "details"])}
    />
  </AdwNavigationView.Page>
  <AdwNavigationView.Page id="details" title="Details" canPop>
    <GtkLabel label="Details content" />
  </AdwNavigationView.Page>
</AdwNavigationView>;
```

### AdwNavigationSplitView

Sidebar/content split layout. Uses `AdwNavigationSplitView.Page`.

```tsx
const [selected, setSelected] = useState(items[0]);
<AdwNavigationSplitView
  sidebarWidthFraction={0.33}
  minSidebarWidth={200}
  maxSidebarWidth={300}
>
  <AdwNavigationSplitView.Page id="sidebar" title="Sidebar">
    <AdwToolbarView>
      <AdwToolbarView.AddTopBar>
        <AdwHeaderBar />
      </AdwToolbarView.AddTopBar>
      <GtkListBox
        cssClasses={["navigation-sidebar"]}
        onRowSelected={(row) => {
          if (!row) return;
          const item = items[row.getIndex()];
          if (item) setSelected(item);
        }}
      >
        {items.map((item) => (
          <AdwActionRow key={item.id} title={item.title} />
        ))}
      </GtkListBox>
    </AdwToolbarView>
  </AdwNavigationSplitView.Page>

  <AdwNavigationSplitView.Page id="content" title={selected?.title ?? ""}>
    <AdwToolbarView>
      <AdwToolbarView.AddTopBar>
        <AdwHeaderBar />
      </AdwToolbarView.AddTopBar>
      <GtkLabel label={selected?.title ?? ""} />
    </AdwToolbarView>
  </AdwNavigationSplitView.Page>
</AdwNavigationSplitView>;
```

**Selection:** Use `GtkListBox` with `onRowSelected` (single click) not `onRowActivated` (double click).

### AdwAlertDialog

Modern modal alert dialog. Uses `AdwAlertDialog.Response`.

```tsx
const [showDialog, setShowDialog] = useState(false);
{
  showDialog && (
    <AdwAlertDialog
      heading="Delete File?"
      body="This action cannot be undone."
      onResponse={(id) => {
        if (id === "delete") handleDelete();
        setShowDialog(false);
      }}
    >
      <AdwAlertDialog.Response id="cancel" label="Cancel" />
      <AdwAlertDialog.Response
        id="delete"
        label="Delete"
        appearance={Adw.ResponseAppearance.DESTRUCTIVE}
      />
    </AdwAlertDialog>
  );
}
```

### GtkColorDialogButton / GtkFontDialogButton

Color and font picker dialogs.

```tsx
<GtkColorDialogButton rgba={color} onRgbaChanged={setColor} title="Select Color" modal withAlpha />
<GtkFontDialogButton fontDesc={font} onFontDescChanged={setFont} title="Select Font" modal useFont useSize />
```

### Other Adwaita Widgets

| Widget           | Description                                        |
| ---------------- | -------------------------------------------------- |
| `AdwClamp`       | Limits content width (`maximumSize={600}`)         |
| `AdwAvatar`      | User avatar (`size={48} text="Name" showInitials`) |
| `AdwSpinner`     | Loading indicator                                  |
| `AdwWindowTitle` | Title + subtitle for header bars                   |
| `AdwButtonRow`   | Button styled as list row                          |

---

## Animations

### AdwTimedAnimation

Duration-based animations with easing.

```tsx
<AdwTimedAnimation
  initial={{ opacity: 0, scale: 0.8 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.8, translateY: 20 }}
  duration={300}
  easing={Adw.Easing.EASE_OUT_CUBIC}
  animateOnMount
>
  <GtkBox>...</GtkBox>
</AdwTimedAnimation>
```

### AdwSpringAnimation

Physics-based spring animations.

```tsx
<AdwSpringAnimation
  initial={{ scale: 0.8 }}
  animate={{ scale: 1 }}
  damping={0.7}
  stiffness={200}
  animateOnMount
>
  <GtkButton label="Add" />
</AdwSpringAnimation>
```

**Shared props:** `initial`, `animate`, `exit`, `animateOnMount`, `onAnimationStart`, `onAnimationComplete`
**Timed only:** `duration`, `easing` (from `Adw.Easing`), `delay`, `repeat`, `reverse`, `alternate`
**Spring only:** `damping`, `stiffness`, `mass`, `initialVelocity`, `clamp`

---

## Drag and Drop

All widgets support drag-and-drop through props. Use `onDragPrepare`, `onDragBegin`, `onDragEnd` to make a widget draggable, and `dropTypes`, `onDrop`, `onDropEnter`, `onDropLeave` to accept drops.

```tsx
import * as Gdk from "@gtkx/ffi/gdk";
import { Type, Value } from "@gtkx/ffi/gobject";

const DraggableButton = ({ label }: { label: string }) => (
  <GtkButton
    label={label}
    onDragPrepare={() =>
      Gdk.ContentProvider.newForValue(Value.newFromString(label))
    }
    dragIcon={someTexture}
  />
);

const DropZone = () => {
  const [dropped, setDropped] = useState<string | null>(null);
  return (
    <GtkBox
      dropTypes={[Type.STRING]}
      onDrop={(value: Value) => {
        setDropped(value.getString());
        return true;
      }}
    >
      <GtkLabel label={dropped ?? "Drop here"} />
    </GtkBox>
  );
};
```

**Drag source props:** `dragIcon`, `dragIconHotX`, `dragIconHotY`

## GValue Factories

| Factory                        | Description                   |
| ------------------------------ | ----------------------------- |
| `Value.newFromString(str)`     | String values                 |
| `Value.newFromDouble(num)`     | 64-bit floating point         |
| `Value.newFromInt(num)`        | 32-bit signed integer         |
| `Value.newFromBoolean(bool)`   | Boolean values                |
| `Value.newFromObject(obj)`     | GObject instances             |
| `Value.newFromBoxed(boxed)`    | Boxed types (Gdk.RGBA, etc.)  |
| `Value.newFromEnum(gtype, n)`  | Enum values (requires GType)  |
| `Value.newFromFlags(gtype, n)` | Flags values (requires GType) |

Type constants for `dropTypes`: `Type.STRING`, `Type.INT`, `Type.DOUBLE`, `Type.BOOLEAN`, `Type.OBJECT`.

## Custom Drawing

Render custom graphics with `GtkDrawingArea` using the `onDraw` callback:

```tsx
import type { Context } from "@gtkx/ffi/cairo";
const Canvas = () => {
  const handleDraw = (cr: Context, width: number, height: number) => {
    cr.setSourceRgb(0.2, 0.4, 0.8);
    cr.rectangle(10, 10, width - 20, height - 20);
    cr.fill();
  };
  return (
    <GtkDrawingArea
      contentWidth={400}
      contentHeight={300}
      onDraw={handleDraw}
    />
  );
};
```

Call `widget.queueDraw()` to trigger redraws.

## Event Controllers

Added as children to any widget. Auto-generated from GTK introspection data.

```tsx
<GtkBox focusable>
  <GtkEventControllerMotion
    onEnter={(x, y) => console.log("Entered at", x, y)}
    onMotion={(x, y) => setPosition({ x, y })}
    onLeave={() => console.log("Left")}
  />
  <GtkEventControllerKey
    onKeyPressed={(keyval, keycode, state) => {
      console.log("Key pressed:", keyval);
      return false;
    }}
  />
  <GtkGestureClick onPressed={(nPress, x, y) => console.log("Clicked")} />
  <GtkLabel label="Hover or type here" />
</GtkBox>
```

**Input controllers:** `GtkEventControllerMotion`, `GtkEventControllerKey`, `GtkEventControllerScroll`, `GtkEventControllerFocus`
**Gesture controllers:** `GtkGestureClick`, `GtkGestureDrag`, `GtkGestureLongPress`, `GtkGestureZoom`, `GtkGestureRotate`, `GtkGestureSwipe`, `GtkGestureStylus`, `GtkGesturePan`
**Drag-and-drop:** `GtkDragSource`, `GtkDropTarget`, `GtkDropControllerMotion`

## SearchBar

```tsx
const [searchActive, setSearchActive] = useState(false);
<GtkSearchBar
  searchModeEnabled={searchActive}
  onSearchModeChanged={setSearchActive}
>
  <GtkSearchEntry
    text={query}
    onSearchChanged={(entry) => setQuery(entry.getText())}
  />
</GtkSearchBar>;
```

## TextView / SourceView

Text content is provided as direct children. Use `x.TextTag` for formatting and `x.TextAnchor` for embedded widgets.

```tsx
<GtkTextView enableUndo onBufferChanged={(text) => console.log(text)}>
  Normal text,{" "}
  <x.TextTag id="bold" weight={Pango.Weight.BOLD}>
    bold
  </x.TextTag>
  , and
  <x.TextAnchor>
    <GtkButton label="Click" />
  </x.TextAnchor>{" "}
  inline.
</GtkTextView>
```

**SourceView additional props:** `language`, `styleScheme`, `highlightSyntax`, `highlightMatchingBrackets`, `implicitTrailingNewline`, `onCursorMoved`, `onHighlightUpdated`

## Keyboard Shortcuts

Attach shortcuts with `<GtkShortcutController>` and `GtkShortcutController.Shortcut`:

```tsx
<GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} focusable>
  <GtkShortcutController scope={Gtk.ShortcutScope.LOCAL}>
    <GtkShortcutController.Shortcut
      trigger="<Control>equal"
      onActivate={() => setCount((c) => c + 1)}
    />
    <GtkShortcutController.Shortcut
      trigger="<Control>minus"
      onActivate={() => setCount((c) => c - 1)}
    />
  </GtkShortcutController>
  <GtkLabel label={`Count: ${count}`} />
</GtkBox>
```

**Scopes:** `LOCAL` (widget focus), `MANAGED` (parent managed), `GLOBAL` (window-wide)
**Trigger syntax:** `<Control>s`, `<Control><Shift>s`, `<Alt>F4`, `<Primary>q`, `F5`
**Multiple triggers:** `trigger={["F5", "<Control>r"]}`
