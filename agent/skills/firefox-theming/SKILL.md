---
name: firefox-theming
description: Writes and audits Firefox userChrome.css and userContent.css against actual Firefox source CSS. Use when editing Firefox chrome styles, fixing dead selectors, or adding missing CSS variable overrides.
---

# Firefox Theming

## Source of truth

Firefox ships CSS inside `omni.ja` (a zip file). Always extract and read source files before writing or auditing userChrome rules.

### Extract source

```bash
OMNI=$(ls /nix/store/*firefox-unwrapped*/lib/firefox/browser/omni.ja 2>/dev/null | head -1)
OMNI_TK=$(ls /nix/store/*firefox-unwrapped*/lib/firefox/omni.ja 2>/dev/null | head -1)
DEST=/tmp/ff-omni

mkdir -p "$DEST" && cd "$DEST"

# CSS
unzip -o "$OMNI" "chrome/browser/skin/classic/browser/*.css" "chrome/browser/skin/classic/browser/**/*.css" 2>/dev/null
unzip -o "$OMNI_TK" "chrome/toolkit/skin/classic/global/*.css" "chrome/toolkit/skin/classic/global/**/*.css" 2>/dev/null

# DevTools
unzip -o "$OMNI" "chrome/devtools/skin/*.css" 2>/dev/null

# XUL/HTML
unzip -o "$OMNI" "chrome/browser/content/browser/browser.xhtml" 2>/dev/null
```

Verify element existence: `grep 'id="element-id"' $DEST/chrome/browser/content/browser/browser.xhtml`.

## Reference

[references/source-map.md](references/source-map.md) — complete variable/element/class reference for:

- **Browser CSS** (`chrome/browser/skin/classic/browser/`): browser-colors, browser-shared, toolbarbuttons, urlbar-searchbar, urlbarView, tabs, sidebar, contextmenu, identity-block, panelUI-shared, unified-extensions, downloads, findbar, and more
- **Toolkit CSS** (`chrome/toolkit/skin/classic/global/`): global-shared, popup, menu, findbar, in-content/common-shared, design-system/tokens-shared
- **DevTools CSS** (`chrome/devtools/skin/`): variables.css theme variables
- **browser.xhtml**: structural IDs, urlbar IDs, sidebar IDs, toolbar button IDs, key classes, non-existent IDs

Consult the source-map first. Extract and read the actual source file when the map lacks detail.

## Workflow

1. **Consult** source-map.md for the section being edited
2. **Extract** source CSS from omni.ja when needed
3. **Read** the relevant source file
4. **Verify** every selector targets elements/classes/IDs that exist in source CSS or browser.xhtml
5. **Verify** every CSS variable override matches a variable defined in source
6. **Use variables** over direct property overrides when the source uses variables
7. **Remove** rules that match nothing

## File placement

| Target            | File              | Selector scope                           |
| ----------------- | ----------------- | ---------------------------------------- |
| Browser chrome    | `userChrome.css`  | `:root`, `#navigator-toolbox`, etc.      |
| Web content pages | `userContent.css` | `@-moz-document` rules                   |
| DevTools          | `userContent.css` | `:root.theme-dark` / `:root.theme-light` |

## DevTools theming

Override DevTools variables in **userContent.css** using `:root.theme-dark` (or `:root.theme-light`).

- Do NOT use `@-moz-document url-prefix("chrome://devtools/content/")` — doesn't match DevTools documents
- Do NOT put DevTools overrides in userChrome.css — DevTools runs in a separate iframe
- Variables are in `chrome/devtools/skin/variables.css`
- Reference: [one-monokai-firefox-devtools](https://github.com/benfaerber/one-monokai-firefox-devtools)

## Search mode indicators

Two systems exist. Hide both when removing the chip:

- **Legacy:** `#urlbar-search-mode-indicator` — shown via `#urlbar[searchmode] > .urlbar-input-container > #urlbar-search-mode-indicator`
- **Scotch Bonnet:** `#searchmode-switcher-chicklet` — shown via `#urlbar[searchmode] #searchmode-switcher-chicklet` (gated behind `browser.urlbar.scotchBonnet.enableOverride` or `browser.urlbar.searchModeSwitcher.featureGate`)
- Related: `#urlbar-searchmode-switcher`, `#searchmode-switcher-title`, `#searchmode-switcher-close`, `#searchmode-switcher-dropmarker`

## When CSS doesn't work

Search online for working reference implementations before guessing. One working example beats ten theories. The [MrOtherGuy/firefox-csshacks](https://github.com/MrOtherGuy/firefox-csshacks) repo is the canonical reference for userChrome hacks.

## Tabs below content

Use CSS grid on `#main-window > body`, NOT `order` / `-moz-box-ordinal-group`:

```css
@media not -moz-pref("sidebar.verticalTabs") {
  #main-window > body {
    display: grid !important;
    grid-template-rows: repeat(8, max-content) 1fr;
    grid-auto-rows: auto;
  }
  #navigator-toolbox {
    display: contents;
  }
  #main-window #browser {
    grid-row: 9 / 10;
  }
  #TabsToolbar {
    grid-row: 10 / 11;
  }
  .browser-toolbar {
    background: inherit;
    background-attachment: fixed;
  }
}
```

Why:

- `order` / `-moz-box-ordinal-group` moves the entire `#navigator-toolbox` — grid lets each toolbar land in its own row
- `-moz-box-ordinal-group` is legacy XUL layout, actively being removed
- `display: contents` on `#navigator-toolbox` is required so its children participate in the grid

Source: `firefox-csshacks/chrome/tabs_below_content_v2.css`

## Hiding tabs with a single tab

Critical rules beyond just collapsing the tab:

```css
#TabsToolbar {
  min-height: 0px !important;
}
#tabbrowser-tabs,
#pinned-tabs-container,
#tabbrowser-arrowscrollbox {
  min-height: 0 !important;
}
.accessibility-indicator,
.private-browsing-indicator {
  height: unset !important;
}
.accessibility-indicator > hbox {
  padding-block: 0 !important;
}

/* Match both :only-of-type AND attribute-based selectors for tab groups/hidden tabs */
.tabbrowser-tab:only-of-type,
.tabbrowser-tab[first-visible-tab="true"][last-visible-tab="true"] {
  visibility: collapse !important;
  min-height: 0 !important;
  height: 0;
}

/* Contain periphery so it can't hold toolbar open */
#tabbrowser-arrowscrollbox-periphery,
#private-browsing-indicator-with-label,
#TabsToolbar > .titlebar-buttonbox-container {
  contain: strict;
  contain-intrinsic-height: 0px;
}
```

Why:

- `:only-of-type` alone fails when tabs are hidden by extensions or tab groups — `[first-visible-tab][last-visible-tab]` covers those cases
- `#pinned-tabs-container` can force minimum height even when all tabs collapse
- `.accessibility-indicator`, `.private-browsing-indicator`, `.titlebar-buttonbox-container`, `#tabbrowser-arrowscrollbox-periphery` all hold the toolbar open without `contain: strict`
- These periphery elements are the most common cause of persistent gaps

Source: `firefox-csshacks/chrome/hide_tabs_with_one_tab.css`

## Removing toolbox borders and separators

Three rules required — setting `--chrome-content-separator-color: transparent` alone is insufficient:

```css
:root[sizemode="normal"] {
  border-top: none !important;
}
#navigator-toolbox::after {
  content: none !important;
}
#navigator-toolbox {
  border-bottom: none !important;
}
```

The `::after` pseudo-element on `#navigator-toolbox` draws a bottom border that CSS variables do not control.

Source: `firefox-csshacks/chrome/hide_toolbox_top_bottom_borders.css`

## Tab background direct overrides

CSS variables like `--tab-border-radius` are not consumed by all internal tab styles. Apply direct overrides:

```css
.tab-background {
  border-radius: 0 !important;
  box-shadow: none !important;
  border-top: 0 !important;
  outline: none !important;
}
```

Source: `firefox-csshacks/chrome/non_floating_sharp_tabs.css`

## Preventing tab animation interference

Firefox's built-in tab animation system can fight visibility collapse:

```css
#TabsToolbar {
  will-change: unset !important;
  transition: none !important;
  opacity: 1 !important;
}
```

Source: `firefox-csshacks/chrome/non_floating_sharp_tabs.css`

## Autohide entire toolbox

Hide all toolbars, show on hover or urlbar focus. Uses `rotateX` transform (GPU-accelerated, no layout shift):

```css
#navigator-toolbox {
  position: fixed !important;
  width: 100vw;
  z-index: 10 !important;
  transition: transform 82ms ease-in-out 600ms !important;
  transform: rotateX(89.9deg);
  transform-origin: top;
  opacity: 0;
}
#navigator-toolbox:is(:hover, :focus-within) {
  transition-delay: 0ms !important;
  transform: rotateX(0deg);
  opacity: 1;
}
```

The `#urlbar[popover]` also needs separate hide/show since it's a popover:

```css
#urlbar[popover] {
  opacity: 0;
  pointer-events: none;
  transition:
    transform 82ms ease-in-out 600ms,
    opacity 0ms 682ms;
  transform: translateY(
    calc(0px - var(--tab-min-height) - var(--urlbar-container-height))
  );
}
#urlbar-container > #urlbar[popover]:is([focused], [open]) {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 0ms;
  transform: translateY(0);
}
```

Keep toolbox visible when any popup is open:

```css
#mainPopupSet:has(> [panelopen]:not(#tab-preview-panel)) ~ #navigator-toolbox {
  transition-delay: 0ms !important;
  transform: rotateX(0deg);
  opacity: 1;
}
```

Source: `firefox-csshacks/chrome/autohide_toolbox.css`

## Autohide nav-bar only

Show nav-bar overlaid on tabs when urlbar is focused. Uses grid to stack toolbars:

```css
:root:not([customizing]) #navigator-toolbox {
  display: grid;
  grid-template-rows: auto;
}
:root:not([customizing]) #navigator-toolbox > .browser-toolbar {
  grid-area: 1/1;
}

:root[sessionrestored] #nav-bar:not([customizing]) {
  transform: rotateX(89.9deg);
  transition:
    transform 67ms linear,
    opacity 0ms linear 67ms !important;
  opacity: 0;
  z-index: 3;
}
:root[sessionrestored] #nav-bar:focus-within {
  transform: rotateX(0deg);
  opacity: 1;
  transition-delay: 0ms, 0ms !important;
}
```

Source: `firefox-csshacks/chrome/show_navbar_on_focus_only.css`

## Autohide tabs toolbar

Hides tabs toolbar, shows on hover. Uses negative margin + transition:

```css
:root {
  --uc-tabs-hide-animation-duration: 48ms;
  --uc-tabs-hide-animation-delay: 200ms;
}
#TabsToolbar:not([customizing]) {
  visibility: hidden;
  position: relative;
  z-index: 1;
  transition:
    visibility 0ms linear var(--uc-tabs-hide-animation-delay),
    margin-bottom var(--uc-tabs-hide-animation-duration) ease-out
      var(--uc-tabs-hide-animation-delay) !important;
}
#navigator-toolbox:has(> :is(#toolbar-menubar, #TabsToolbar):hover)
  > #TabsToolbar {
  visibility: visible;
  margin-bottom: 0px;
  transition-delay: 0ms, 0ms !important;
}
```

Source: `firefox-csshacks/chrome/autohide_tabstoolbar_v2.css`

## Autohide bookmarks toolbar

Uses `rotateX` with configurable delay:

```css
#PersonalToolbar {
  --uc-bm-height: 20px;
  --uc-bm-padding: 4px;
  --uc-autohide-toolbar-delay: 600ms;
}
#PersonalToolbar:not([customizing]) {
  position: relative;
  margin-bottom: calc(-1px - var(--uc-bm-height) - 2 * var(--uc-bm-padding));
  transform: rotateX(90deg);
  transform-origin: top;
  transition: transform 135ms linear var(--uc-autohide-toolbar-delay) !important;
  z-index: 1;
}
#navigator-toolbox:hover > #PersonalToolbar {
  transition-delay: 100ms !important;
  transform: rotateX(0);
}
```

Source: `firefox-csshacks/chrome/autohide_bookmarks_toolbar.css`

## Autohide sidebar

Collapses sidebar to narrow strip, expands on hover:

```css
#sidebar-box {
  --uc-sidebar-width: 40px;
  --uc-sidebar-hover-width: 210px;
  --uc-autohide-sidebar-delay: 600ms;
  --uc-autohide-transition-duration: 115ms;
  min-width: var(--uc-sidebar-width) !important;
  width: var(--uc-sidebar-width) !important;
  max-width: var(--uc-sidebar-width) !important;
  z-index: 3;
  position: relative;
}
#sidebar-header,
#sidebar {
  transition: min-width var(--uc-autohide-transition-duration) linear
    var(--uc-autohide-sidebar-delay) !important;
  min-width: var(--uc-sidebar-width) !important;
  will-change: min-width;
}
#sidebar-box:hover > #sidebar-header,
#sidebar-box:hover > #sidebar {
  min-width: var(--uc-sidebar-hover-width) !important;
  transition-delay: 0ms !important;
}
#sidebar-splitter {
  display: none;
}
```

Source: `firefox-csshacks/chrome/autohide_sidebar.css`

## Hide tabs toolbar entirely

For use with tree-style-tab or native vertical tabs. Moves window controls to nav-bar:

```css
@media not -moz-pref("sidebar.verticalTabs") {
  #TabsToolbar:not([customizing]) {
    visibility: collapse;
  }
  :root[customtitlebar]
    #toolbar-menubar:is([autohide=""], [autohide="true"])
    ~ #nav-bar {
    > .titlebar-buttonbox-container {
      display: flex !important;
    }
    :root[sizemode="normal"] & {
      > .titlebar-spacer {
        display: flex !important;
      }
    }
  }
}
@media -moz-pref("sidebar.verticalTabs") {
  #sidebar-launcher-splitter,
  #sidebar-main {
    visibility: collapse;
  }
}
```

Source: `firefox-csshacks/chrome/hide_tabs_toolbar_v2.css`

## Tabs on bottom (within toolbox)

Reorders TabsToolbar below nav-bar without moving below content. Uses `order`:

```css
@media not -moz-pref("sidebar.verticalTabs") {
  .global-notificationbox,
  #tab-notification-deck,
  #notifications-toolbar,
  #TabsToolbar {
    order: 1;
  }
  #TabsToolbar > :is(.titlebar-spacer, .titlebar-buttonbox-container) {
    display: none;
  }
  :root[customtitlebar]
    #toolbar-menubar:is([autohide=""], [autohide="true"], [collapsed])
    ~ #nav-bar {
    > .titlebar-buttonbox-container {
      display: flex !important;
    }
  }
}
```

Source: `firefox-csshacks/chrome/tabs_on_bottom_v2.css`

## All toolbars below content

Moves entire toolbox below content. Uses `display: contents` + `order`:

```css
#navigator-toolbox {
  display: contents;
  --uc-navbar-height: 40px;
}
#main-window > body > #browser,
.global-notificationbox,
#tab-notification-deck,
#notifications-toolbar,
#toolbar-menubar {
  order: -1;
}
```

Urlbar breakout must flip direction when toolbars are below:

```css
#urlbar[breakout][breakout-extend] {
  display: flex !important;
  flex-direction: column-reverse !important;
  transform: translateY(calc(var(--urlbar-container-height) - 100%));
}
.urlbarView-body-inner {
  border-top-style: none !important;
}
```

Source: `firefox-csshacks/chrome/toolbars_below_content_v2.css`

## One-line toolbar (tabs + nav-bar side by side)

Uses CSS grid with fractional columns:

```css
@media not -moz-pref("sidebar.verticalTabs") {
  :root:not([chromehidden~="toolbar"]) #navigator-toolbox {
    display: grid;
    grid-template-columns: 6fr 4fr;
  }
  #toolbar-menubar,
  #PersonalToolbar,
  .global-notificationbox {
    grid-column: 1/3;
  }
  #TabsToolbar,
  #nav-bar {
    grid-row: 2/3;
  }
  #nav-bar {
    border-top: none !important;
  }
}
```

Source: `firefox-csshacks/chrome/oneline_toolbar.css`

## Combined tabs + nav-bar

Tabs share space with nav-bar using flex-wrap:

```css
#navigator-toolbox {
  display: flex;
  flex-direction: row-reverse;
  flex-wrap: wrap;
}
#nav-bar,
#PersonalToolbar {
  flex-grow: 1000;
}
#urlbar-container {
  min-width: 250px !important;
}
#urlbar[open]:focus-within {
  min-width: var(--uc-urlbar-min-width, none) !important;
}
```

Source: `firefox-csshacks/chrome/combined_tabs_and_main_toolbars.css`

## Vertical tabs (sidebar-style)

Uses `position: absolute` on `#tabbrowser-tabs` with margin on content:

```css
:root:not([customizing]) {
  --uc-vertical-tabs-width: 220px;
  --uc-navbar-height: 40px;
}
#PersonalToolbar,
#main-window:not([inDOMFullscreen]) > body > #browser {
  margin-left: var(--uc-vertical-tabs-width);
}
:root:not([customizing]) #tabbrowser-tabs {
  position: absolute !important;
  height: 100vh;
  left: 0;
  padding-top: var(--uc-navbar-height);
  width: var(--uc-vertical-tabs-width);
  background-color: var(--toolbar-bgcolor);
  contain: size;
}
```

Source: `firefox-csshacks/chrome/vertical_tabs.css`

## Multi-row tabs

Flexbox wrap with scroll:

```css
:root {
  --multirow-n-rows: 3;
  --multirow-tab-min-width: 100px;
}
#tabbrowser-tabs[orient="horizontal"] {
  min-height: unset !important;
  flex-wrap: wrap;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: calc(
    (var(--tab-min-height) + 2 * var(--tab-block-margin, 0px)) *
      var(--multirow-n-rows)
  );
  scrollbar-width: thin;
  scroll-snap-type: y mandatory;
}
.tabbrowser-tab {
  scroll-snap-align: start;
}
#tabbrowser-tabs .tabbrowser-tab[pinned] {
  position: static !important;
}
```

Tab reordering does not work with multi-row. Hide scroll buttons and spacer:

```css
#scrollbutton-up,
#scrollbutton-down {
  display: none;
}
#tabbrowser-arrowscrollbox > spacer {
  display: none !important;
}
```

Source: `firefox-csshacks/chrome/multi-row_tabs.css`

## Nav-bar below content

Uses `position: fixed` at bottom. Must use `-webkit-box` display (not `flex`) to avoid breaking extension menus:

```css
#browser {
  margin-bottom: var(--uc-bottom-toolbar-height, 0px);
}
#nav-bar {
  position: fixed !important;
  bottom: 0px;
  display: -webkit-box;
  width: 100%;
  z-index: 1;
}
#nav-bar-customization-target {
  -webkit-box-flex: 1;
}
```

Urlbar breakout flips upward:

```css
#urlbar[breakout][breakout-extend] {
  display: flex !important;
  flex-direction: column-reverse !important;
  bottom: 0px !important;
  top: auto !important;
}
```

Source: `firefox-csshacks/chrome/navbar_below_content.css`

## Floating findbar

Overlays findbar at top of content area instead of pushing content down:

```css
findbar {
  order: -1;
  margin-bottom: -33px;
  position: relative;
  border-top: none !important;
  padding: 0 !important;
  background: none !important;
  pointer-events: none;
  z-index: 1;
}
findbar > .findbar-container,
findbar > .close-icon {
  background-color: var(--lwt-accent-color, var(--toolbox-bgcolor)) !important;
  pointer-events: auto;
  border-bottom-right-radius: 4px;
}
findbar[hidden] {
  transform: translateY(-30px);
}
```

Source: `firefox-csshacks/chrome/floating_findbar_on_top.css`

## Overlay fullscreen toolbars

Toolbars float over content in fullscreen instead of pushing it down:

```css
@media -moz-pref("browser.fullscreen.autohide") {
  :root[sizemode="fullscreen"] #navigator-toolbox {
    position: fixed !important;
    width: 100vw;
    z-index: 10 !important;
    transition: transform 82ms ease-in-out 600ms !important;
    transform: translateY(-100%);
  }
  :root[sizemode="fullscreen"] #navigator-toolbox:is(:hover, :focus-within) {
    transition-delay: 0ms !important;
    transform: translateY(0);
  }
}
```

Source: `firefox-csshacks/chrome/overlay_fullscreen_toolbars.css`

## Compact proton

Variables for compact density:

```css
:root {
  --toolbarbutton-inner-padding: 6px !important;
  --tab-block-margin: 2px !important;
  --tabs-shadow-size: 0px !important;
  --arrowpanel-menuitem-padding-block: 5px !important;
  --panel-font-size: inherit !important;
  --arrowpanel-padding: 0.8em !important;
  --tab-inline-padding: 8px !important;
}
#nav-bar {
  box-shadow: inset 0 var(--tabs-shadow-size) 0 var(--lwt-tabs-border-color) !important;
}
.tab-close-button {
  width: 20px !important;
  height: 20px !important;
  padding: 5px !important;
}
```

Source: `firefox-csshacks/chrome/compact_proton.css`

## Compact urlbar

Prevents urlbar breakout expansion:

```css
#urlbar[breakout][breakout-extend] {
  margin-left: 0 !important;
  width: var(--urlbar-width) !important;
  margin-top: calc(
    (var(--urlbar-container-height) - var(--urlbar-height)) / 2
  ) !important;
}
:where(#urlbar) > .urlbar-background,
#urlbar-background {
  animation: none !important;
}
:where(#urlbar) > .urlbar-input-container {
  padding: var(--urlbar-container-padding, 0) 1px !important;
  height: var(--urlbar-height) !important;
}
```

Source: `firefox-csshacks/chrome/compact_urlbar_megabar.css`

## Rounded menupopups

Rounding panels, menus, urlbar consistently:

```css
:root {
  --uc-menupopup-border-radius: 20px;
}
panel[type="autocomplete-richlistbox"],
menupopup,
.panel-arrowcontent {
  -moz-appearance: none !important;
  border-radius: var(--uc-menupopup-border-radius) !important;
  overflow: clip !important;
}
/* Match urlbar and searchbar */
searchbar#searchbar,
:where(#urlbar) > .urlbar-background,
#urlbar-background {
  border-radius: var(--uc-menupopup-border-radius) !important;
}
/* Fix panel arrow position */
panel[type="arrow"] {
  margin-inline-end: calc(-10px - var(--uc-menupopup-border-radius)) !important;
}
.panel-arrow {
  margin-inline: var(--uc-menupopup-border-radius) !important;
}
```

Source: `firefox-csshacks/chrome/rounded_menupopups.css`

## Minimal toolbar buttons

Hide buttons as dots, reveal on hover using `transform: scale(0)`:

```css
toolbar .toolbarbutton-1 > * {
  transform: scale(0);
  transition: transform 82ms linear !important;
}
toolbar:hover .toolbarbutton-1 > * {
  transform: scale(1);
}
/* Dot placeholder */
toolbar .toolbarbutton-1:not([open]) {
  background-image: radial-gradient(
    circle at center,
    currentColor 0,
    currentColor 10%,
    transparent 15%
  );
}
toolbar:hover .toolbarbutton-1 {
  background-image: none;
}
```

Source: `firefox-csshacks/chrome/minimal_toolbarbuttons_v3.css`

## Color variable template

Key variables for full theme override:

```css
:root {
  --arrowpanel-background: <color> !important;
  --arrowpanel-border-color: <color> !important;
  --arrowpanel-color: <color> !important;
  --lwt-accent-color: <color> !important;
  --toolbar-bgcolor: <color> !important;
  --tab-selected-bgcolor: <color> !important;
  --lwt-text-color: <color> !important;
  --toolbarbutton-icon-fill: <color> !important;
  --toolbar-field-background-color: <color> !important;
  --toolbar-field-focus-background-color: <color> !important;
  --toolbar-field-color: <color> !important;
  --toolbar-field-focus-color: <color> !important;
  --toolbar-field-border-color: <color> !important;
  --toolbar-field-focus-border-color: <color> !important;
  --lwt-sidebar-background-color: <color> !important;
  --lwt-sidebar-text-color: <color> !important;
}
#navigator-toolbox {
  --lwt-tabs-border-color: <color> !important;
}
#tabbrowser-tabs {
  --lwt-tab-line-color: <color> !important;
}
#sidebar-box {
  --sidebar-background-color: <color> !important;
}
```

Source: `firefox-csshacks/chrome/color_variable_template.css`

## Linux GTK window controls patch

CSD buttons don't respect layout rules by default on Linux:

```css
.titlebar-buttonbox {
  align-items: stretch !important;
}
.titlebar-button {
  -moz-appearance: none !important;
  -moz-context-properties: fill, stroke, fill-opacity;
  fill: currentColor;
  padding: 4px 6px !important;
  flex-grow: 1;
  overflow: clip;
}
```

Source: `firefox-csshacks/chrome/linux_gtk_window_control_patch.css`

## Window controls on left

Use `@media -moz-pref("userchrome.force-window-controls-on-left.enabled")`:

```css
@media -moz-pref("userchrome.force-window-controls-on-left.enabled") {
  #nav-bar > .titlebar-buttonbox-container {
    order: -1 !important;
    > .titlebar-buttonbox {
      flex-direction: row-reverse;
    }
  }
}
```

Also detectable via `(-moz-gtk-csd-reversed-placement)` or `(-moz-platform: macos)`.

## `-moz-pref()` media queries

Firefox 133+ supports `@media -moz-pref("pref.name")` for conditional CSS based on `about:config` prefs. Used extensively by firefox-csshacks for toggleable features:

- `sidebar.verticalTabs` — native vertical tabs enabled
- `browser.fullscreen.autohide` — fullscreen toolbar autohide
- `userchrome.*` — custom user prefs for CSS feature toggles

## Common mistakes

- `#id` vs `.class` — check source (e.g. `.private-browsing-indicator-with-label` is a class, not an ID)
- Shadow DOM parts (`scrollbutton-up`, `scrollbutton-down`) are `::part()`, not IDs
- `tab` bare element doesn't match — use `.tabbrowser-tab`
- Pseudo-elements (`::before`, `::after`) — verify they exist in source before targeting
- Border/separator overrides — find which element has the border (e.g. `.urlbarView-body-inner`, not `.urlbarView-body-outer`)
- `.searchbar-engine-one-off-item` is not inside `#urlbar`
- `#context-sep-navigation` is in browser.xhtml, not in CSS
- `#pocket-button`, `#scrollbutton-up`, `#scrollbutton-down` do not exist in browser.xhtml
- `order` / `-moz-box-ordinal-group` for layout reordering — use CSS grid instead
- Setting CSS variables without `!important` direct overrides — internal styles may not consume the variable
- Relying on `visibility: collapse` without zeroing `min-height` on all child containers
- Missing `contain: strict` on periphery elements when collapsing toolbars — they hold height open
- Adding `!important` to variables — variables are automatically applied, `!important` on them is pointless
- Duplicate `user_pref()` lines in user.js — last one wins silently, remove duplicates
- GNOME theme prefs (`gnomeTheme.*`) conflict with custom tab positioning
