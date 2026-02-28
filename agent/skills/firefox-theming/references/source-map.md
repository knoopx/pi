# Firefox Source CSS Map

Path prefix: `chrome/browser/skin/classic/browser/`

## browser-colors.css

Root-level CSS variables for the entire chrome UI.

| Variable                                                                       | Controls                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `--toolbox-bgcolor`, `--toolbox-textcolor`                                     | Main chrome background/text                              |
| `--toolbox-bgcolor-inactive`, `--toolbox-textcolor-inactive`                   | Inactive window chrome                                   |
| `--toolbar-field-*`                                                            | Urlbar field colors (set on root, not on field elements) |
| `--tab-selected-bgcolor`, `--tab-selected-textcolor`                           | Selected tab                                             |
| `--tabs-navbar-separator-style`, `--tabs-navbar-separator-color`               | Tab/navbar separator                                     |
| `--chrome-content-separator-color`                                             | Line between chrome and content                          |
| `--arrowpanel-background`, `--arrowpanel-color`, `--arrowpanel-border-color`   | Panels/popups                                            |
| `--arrowpanel-dimmed`, `--arrowpanel-dimmed-further`                           | Hover/active states in panels                            |
| `--sidebar-background-color`, `--sidebar-text-color`, `--sidebar-border-color` | Sidebar                                                  |
| `--urlbar-box-bgcolor`, `--urlbar-box-focus-bgcolor`                           | Urlbar UI element backgrounds                            |
| `--urlbar-box-hover-bgcolor`, `--urlbar-box-active-bgcolor`                    | Urlbar hover/active                                      |
| `--urlbar-box-text-color`, `--urlbar-box-hover-text-color`                     | Urlbar UI text                                           |
| `--link-color`                                                                 | Link color used in urlbar results                        |
| `--lwt-accent-color`, `--lwt-text-color`                                       | Lightweight theme overrides                              |
| `--focus-outline-color`                                                        | Focus ring color                                         |
| `--input-bgcolor`, `--input-color`, `--input-border-color`                     | Input field defaults                                     |

## browser-shared.css

Layout variables and structural defaults.

| Variable                        | Controls               |
| ------------------------------- | ---------------------- |
| `--toolbarbutton-border-radius` | Button corner radius   |
| `--urlbar-min-height`           | Minimum urlbar height  |
| `--urlbar-icon-padding`         | Icon padding in urlbar |

## urlbar-searchbar.css

Urlbar container, breakout popover, input, and page action buttons.

Key elements: `#urlbar`, `#urlbar-container`, `#urlbar-background`, `.urlbar-input-container`, `#urlbar-search-mode-indicator` (ID, not class).

The urlbar breakout uses `popover="manual"`. When `[breakout][breakout-extend]` is set, the urlbar expands with `#urlbar-background` providing the visual container.

## urlbarView.css

Autocomplete results dropdown.

| Variable                                                            | Controls                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `--urlbarView-hover-background`                                     | Row hover                                                       |
| `--urlbarView-separator-color`                                      | Divider between input and results (on `.urlbarView-body-inner`) |
| `--urlbarView-highlight-background`, `--urlbarView-highlight-color` | Selected row                                                    |
| `--urlbarView-secondary-text-color`                                 | Dimmed secondary text                                           |
| `--urlbarView-action-color`                                         | Action label color                                              |

Key structure:

```
.urlbarView
  .urlbarView-body-outer
    .urlbarView-body-inner      ← border-top (separator) lives here
      .urlbarView-results
        .urlbarView-row
          .urlbarView-row-inner
            .urlbarView-favicon
            .urlbarView-title
            .urlbarView-url
            .urlbarView-action
```

No `::before`/`::after` pseudo-elements on `.urlbarView` or `.urlbarView-body-outer`.

## tabbrowser/tabs.css

Tab bar, tab elements, throbber, close button.

- Tabs use `.tabbrowser-tab`, not bare `tab` element
- `[fadein]`, `[busy]`, `[progress]`, `[selected]`, `[pinned]` attributes
- `--tab-block-margin` (no `--proton-tab-block-margin`)
- `--tab-label-mask-size`, `--tab-overflow-clip-margin`
- `#alltabs-button` exists
- Scroll buttons are shadow DOM `::part(scrollbutton-up)`, not IDs
- `.tab-throbber`, `.tab-background`, `.tab-content`, `.tab-label`, `.tab-close-button`, `.tab-label-container`
- `[noshadowfortests]`, `[secondarytext-unsupported]` attributes exist

## tabbrowser/content-area.css

`#statuspanel-label` styling.

## sidebar.css

`#sidebar-box`, `#sidebar-header`, `#sidebar` elements.

## downloads/downloads.inc.css

`#downloadsListBox`, `#emptyDownloads`, `richlistitem` rows.

## contextmenu.css

`#context-navigation` (exists). `#context-sep-navigation` is in browser.xhtml, not in CSS.

## toolkit: findbar.css

Path: `chrome/toolkit/skin/classic/global/findbar.css`

Uses `xul|findbar` element selector. Classes: `.findbar-textbox`, `.findbar-find-previous`, `.findbar-find-next`, `.findbar-find-status`, `.found-matches`, `.findbar-container`.

No `.findbar-highlight` class exists.

## Elements to verify in browser.xhtml

These IDs exist in browser.xhtml: `#fullscreen-warning`, `#identity-permission-box`, `#urlbar-search-button`, `#urlbar-go-button`, `#context-sep-navigation`, `#context-navigation`, `#downloadsPanel`, `#downloadsListBox`, `#emptyDownloads`, `#statuspanel-label`, `#permission-popup`, `#identity-popup`.

These do NOT exist: `#pocket-button`, `#scrollbutton-up`, `#scrollbutton-down`.

`.private-browsing-indicator-with-label` is a class, not an ID.
