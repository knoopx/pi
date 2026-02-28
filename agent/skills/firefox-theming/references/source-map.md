# Firefox Source CSS Map

Path prefix: `chrome/browser/skin/classic/browser/`

Extracted from Firefox 140 `omni.ja`.

---

## browser-colors.css

Root-level CSS variables for the entire chrome UI.

### Chrome window

| Variable                           | Controls                          |
| ---------------------------------- | --------------------------------- |
| `--toolbox-bgcolor`                | Main chrome background            |
| `--toolbox-textcolor`              | Main chrome text                  |
| `--toolbox-bgcolor-inactive`       | Inactive window chrome background |
| `--toolbox-textcolor-inactive`     | Inactive window chrome text       |
| `--toolbar-bgcolor`                | Toolbar background                |
| `--toolbar-color`                  | Toolbar text                      |
| `--chrome-content-separator-color` | Line between chrome and content   |

### Tabs

| Variable                        | Controls                                       |
| ------------------------------- | ---------------------------------------------- |
| `--tab-selected-bgcolor`        | Selected tab background                        |
| `--tab-selected-textcolor`      | Selected tab text                              |
| `--tabs-navbar-separator-style` | Tab/navbar separator style (`none` or `solid`) |
| `--tabs-navbar-separator-color` | Tab/navbar separator color                     |

### Urlbar

| Variable                                 | Controls                             |
| ---------------------------------------- | ------------------------------------ |
| `--toolbar-field-background-color`       | Urlbar background                    |
| `--toolbar-field-color`                  | Urlbar text                          |
| `--toolbar-field-border-color`           | Urlbar border                        |
| `--toolbar-field-focus-background-color` | Focused urlbar background            |
| `--toolbar-field-focus-color`            | Focused urlbar text                  |
| `--urlbar-box-bgcolor`                   | Urlbar UI element background         |
| `--urlbar-box-focus-bgcolor`             | Urlbar UI element focused background |
| `--urlbar-box-hover-bgcolor`             | Urlbar UI element hover background   |
| `--urlbar-box-active-bgcolor`            | Urlbar UI element active background  |
| `--urlbar-box-text-color`                | Urlbar UI element text               |
| `--urlbar-box-hover-text-color`          | Urlbar UI element hover text         |
| `--urlbar-icon-fill-opacity`             | Urlbar icon opacity                  |

### Urlbar results

| Variable                            | Controls                                                           |
| ----------------------------------- | ------------------------------------------------------------------ |
| `--urlbarView-hover-background`     | Row hover                                                          |
| `--urlbarView-highlight-background` | Selected row background                                            |
| `--urlbarView-highlight-color`      | Selected row text                                                  |
| `--urlbarView-separator-color`      | Divider between input and results                                  |
| `--urlbarView-action-color`         | Action label                                                       |
| `--urlbarView-secondary-text-color` | Dimmed secondary text (defined in urlbarView.css, overridden here) |

### Panels/popups

| Variable                      | Controls                |
| ----------------------------- | ----------------------- |
| `--arrowpanel-background`     | Panel background        |
| `--arrowpanel-color`          | Panel text              |
| `--arrowpanel-border-color`   | Panel border            |
| `--arrowpanel-dimmed`         | Hover states in panels  |
| `--arrowpanel-dimmed-further` | Active states in panels |

### Sidebar

| Variable                     | Controls           |
| ---------------------------- | ------------------ |
| `--sidebar-background-color` | Sidebar background |
| `--sidebar-text-color`       | Sidebar text       |
| `--sidebar-border-color`     | Sidebar border     |

### Inputs

| Variable                | Controls               |
| ----------------------- | ---------------------- |
| `--input-bgcolor`       | Input field background |
| `--input-color`         | Input field text       |
| `--focus-outline-color` | Focus ring color       |

### Icons and links

| Variable                              | Controls                     |
| ------------------------------------- | ---------------------------- |
| `--toolbarbutton-icon-fill`           | Toolbar icon fill            |
| `--toolbarbutton-icon-fill-attention` | Attention icon fill (badges) |
| `--link-color`                        | Link color in urlbar results |
| `--color-accent-primary`              | Accent color                 |
| `--attention-dot-color`               | Notification dot color       |

### Lightweight theme overrides

| Variable             | Controls                                     |
| -------------------- | -------------------------------------------- |
| `--lwt-accent-color` | Theme accent (overrides `--toolbox-bgcolor`) |
| `--lwt-text-color`   | Theme text (overrides `--toolbox-textcolor`) |

### Button system

| Variable                           | Controls                  |
| ---------------------------------- | ------------------------- |
| `--button-background-color`        | Button default background |
| `--button-background-color-hover`  | Button hover background   |
| `--button-background-color-active` | Button active background  |
| `--button-text-color`              | Button text               |

---

## browser-shared.css

Layout variables and structural defaults.

| Variable                                        | Controls                     |
| ----------------------------------------------- | ---------------------------- |
| `--toolbarbutton-border-radius`                 | Button corner radius         |
| `--urlbar-min-height`                           | Minimum urlbar height        |
| `--urlbar-icon-padding`                         | Icon padding in urlbar       |
| `--urlbar-icon-border-radius`                   | Icon border radius in urlbar |
| `--urlbar-searchmodeswitcher-inline-padding`    | Search mode switcher padding |
| `--urlbar-searchmodeswitcher-margin-inline-end` | Search mode switcher margin  |
| `--identity-box-margin-inline`                  | Identity box margin          |
| `--inactive-titlebar-opacity`                   | Inactive titlebar opacity    |
| `--pocket-icon-fill`                            | Pocket icon fill             |

Z-index layers (browser area):

| Variable                                         | Controls                 |
| ------------------------------------------------ | ------------------------ |
| `--browser-area-z-index-toolbox`                 | Toolbox z-index          |
| `--browser-area-z-index-sidebar`                 | Sidebar z-index          |
| `--browser-area-z-index-sidebar-expand-on-hover` | Sidebar expand z-index   |
| `--browser-area-z-index-sidebar-splitter`        | Sidebar splitter z-index |
| `--browser-area-z-index-tabbox`                  | Tabbox z-index           |

---

## toolbarbuttons.css

Toolbar button styling, spacing, outlines.

| Variable                                 | Controls                      |
| ---------------------------------------- | ----------------------------- |
| `--toolbar-start-end-padding`            | Toolbar start/end padding     |
| `--toolbarbutton-outer-padding`          | Button outer padding          |
| `--toolbarbutton-inner-padding`          | Button inner padding          |
| `--toolbarbutton-hover-background`       | Button hover background       |
| `--toolbarbutton-active-background`      | Button active background      |
| `--toolbarbutton-outline-color`          | Button outline color          |
| `--toolbarbutton-hover-outline-color`    | Button hover outline          |
| `--toolbarbutton-active-outline-color`   | Button active outline         |
| `--toolbarbutton-selected-outline-color` | Button selected outline       |
| `--toolbarbutton-outline`                | Button outline shorthand      |
| `--toolbarbutton-outline-offset`         | Button outline offset         |
| `--toolbarseparator-color`               | Toolbar separator color       |
| `--bookmark-block-padding`               | Bookmark button block padding |

Key IDs: `#back-button`, `#forward-button`, `#reload-button`, `#stop-button`, `#home-button`, `#downloads-button`, `#library-button`, `#fullscreen-button`, `#bookmarks-toolbar-button`, `#find-button`, `#print-button`.

---

## toolbarbutton-icons.css

Icon definitions (list-style-image / fill) for toolbar buttons. References the same IDs as toolbarbuttons.css. No CSS variables defined — icon URLs only.

---

## urlbar-searchbar.css

Urlbar container, breakout popover, input, and page action buttons.

Key IDs: `#urlbar`, `#urlbar-container`, `#urlbar-background`, `#urlbar-input`, `#urlbar-go-button`, `#urlbar-search-button`, `#urlbar-revert-button`, `#urlbar-search-mode-indicator`, `#urlbar-search-mode-indicator-title`, `#urlbar-search-mode-indicator-close`, `#searchmode-switcher-chicklet`, `#searchmode-switcher-title`, `#searchmode-switcher-close`, `#searchmode-switcher-dropmarker`, `#urlbar-searchmode-switcher`, `#urlbar-zoom-button`.

Key classes: `.urlbar-input-container`, `.urlbar-page-action`, `.urlbar-icon`, `.urlbar-go-button`, `.urlbar-revert-button`.

The urlbar breakout uses `popover="manual"`. When `[breakout][breakout-extend]` is set, the urlbar expands with `#urlbar-background` providing the visual container.

---

## urlbarView.css

Autocomplete results dropdown.

| Variable                                               | Controls                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `--urlbarView-hover-background`                        | Row hover                                                       |
| `--urlbarView-highlight-background`                    | Selected row background                                         |
| `--urlbarView-highlight-color`                         | Selected row text                                               |
| `--urlbarView-separator-color`                         | Divider between input and results (on `.urlbarView-body-inner`) |
| `--urlbarView-secondary-text-color`                    | Dimmed secondary text                                           |
| `--urlbarView-action-color`                            | Action label color                                              |
| `--urlbarView-action-button-background-color`          | Action button background                                        |
| `--urlbarView-action-button-hover-background-color`    | Action button hover                                             |
| `--urlbarView-result-button-background-opacity`        | Result button opacity                                           |
| `--urlbarView-result-button-hover-background-color`    | Result button hover background                                  |
| `--urlbarView-result-button-hover-color`               | Result button hover text                                        |
| `--urlbarView-result-button-selected-background-color` | Result button selected background                               |
| `--urlbarView-result-button-selected-color`            | Result button selected text                                     |
| `--urlbarView-favicon-width`                           | Favicon width                                                   |
| `--urlbarView-favicon-margin-start`                    | Favicon margin start                                            |
| `--urlbarView-favicon-margin-end`                      | Favicon margin end                                              |
| `--urlbarView-item-block-padding`                      | Row block padding                                               |
| `--urlbarView-item-inline-padding`                     | Row inline padding                                              |
| `--urlbarView-results-padding`                         | Results container padding                                       |
| `--urlbarView-row-gutter`                              | Gap between rows                                                |
| `--urlbarView-small-font-size`                         | Small text font size                                            |

Structure:

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

---

## urlbar-dynamic-results.css

Styling for dynamic urlbar result types (weather, addon suggestions, trending, etc.). Uses `.urlbarView-dynamic-*` classes. 407 lines. No reusable CSS variables.

---

## tabbrowser/tabs.css

Tab bar, tab elements, throbber, close button.

### Tab variables

| Variable                       | Controls                                          |
| ------------------------------ | ------------------------------------------------- |
| `--tab-min-height`             | Tab minimum height                                |
| `--tab-min-width`              | Tab minimum width                                 |
| `--tab-block-margin`           | Tab block margin (no `--proton-tab-block-margin`) |
| `--tab-border-radius`          | Tab corner radius                                 |
| `--tab-inline-padding`         | Tab inline padding                                |
| `--tab-inner-inline-margin`    | Tab inner inline margin                           |
| `--tab-close-button-padding`   | Close button padding                              |
| `--tab-label-mask-size`        | Label fade mask size                              |
| `--tab-label-line-height`      | Label line height                                 |
| `--tab-overflow-clip-margin`   | Overflow clip margin                              |
| `--tab-loading-fill`           | Loading indicator color                           |
| `--tab-hover-background-color` | Tab hover background                              |
| `--tab-hover-outline-color`    | Tab hover outline                                 |
| `--tab-outline`                | Tab outline shorthand                             |
| `--tab-outline-color`          | Tab outline color                                 |
| `--tab-outline-offset`         | Tab outline offset                                |
| `--tab-selected-bgcolor`       | Selected tab background (also in browser-colors)  |
| `--tab-selected-textcolor`     | Selected tab text (also in browser-colors)        |
| `--tab-selected-outline-color` | Selected tab outline                              |
| `--tab-selected-shadow`        | Selected tab shadow                               |
| `--tab-selected-shadow-size`   | Selected tab shadow size                          |
| `--tabstrip-inner-border`      | Tab strip inner border                            |
| `--tabstrip-min-height`        | Tab strip minimum height                          |

### Tab group variables

| Variable                          | Controls                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| `--tab-group-color-{name}`        | Group color (blue, cyan, gray, green, orange, pink, purple, red, yellow) |
| `--tab-group-color-{name}-invert` | Group inverted color                                                     |
| `--tab-group-color-{name}-pale`   | Group pale color                                                         |
| `--tab-group-label-height`        | Group label height                                                       |
| `--tab-group-label-padding`       | Group label padding                                                      |
| `--tab-group-line-thickness`      | Group indicator line thickness                                           |

### Vertical tabs variables

| Variable                           | Controls                      |
| ---------------------------------- | ----------------------------- |
| `--tab-collapsed-width`            | Collapsed vertical tab width  |
| `--tab-collapsed-background-width` | Collapsed background width    |
| `--tab-overflow-pinned-tabs-width` | Pinned tabs overflow width    |
| `--vertical-tabs-scrollbar-color`  | Vertical tabs scrollbar color |

### Tab structure

- Tab element: `.tabbrowser-tab` (not bare `tab`)
- Attributes: `[fadein]`, `[busy]`, `[progress]`, `[selected]`, `[pinned]`, `[noshadowfortests]`, `[secondarytext-unsupported]`
- Children: `.tab-background`, `.tab-content`, `.tab-label-container`, `.tab-label`, `.tab-close-button`, `.tab-throbber`
- Tab bar: `#tabbrowser-tabs`, `#tabbrowser-arrowscrollbox`
- Buttons: `#tabs-newtab-button`, `#new-tab-button`, `#alltabs-button` (`.tabs-alltabs-button`)
- Scroll buttons: `::part(scrollbutton-up)`, `::part(scrollbutton-down)` — shadow DOM parts, not IDs
- Vertical tabs: `#vertical-tabs`, `#vertical-pinned-tabs-container`
- Tab groups: `#tab-group-editor`
- Preview: `#tab-preview-panel` (in tab-hover-preview.css)

---

## tabbrowser/content-area.css

`#statuspanel-label` styling.

---

## tabbrowser/tab-hover-preview.css

Tab hover preview panel. Key ID: `#tab-preview-panel`. Classes: `.tab-preview-thumbnail-container`, `.tab-preview-text-container`, `.tab-preview-title`, `.tab-preview-uri`.

---

## tabbrowser/ctrlTab.css

Ctrl+Tab panel. Key IDs: `#ctrlTab-panel`, `#ctrlTab-showAll`.

---

## tabbrowser/fullscreen-and-pointerlock.css

Fullscreen warning, pointer lock UI, toolbar autohide.

Key IDs: `#fullscreen-warning`, `#fullscreen-exit-button`, `#fullscr-toggler`, `#navigator-toolbox`.

Hides sidebar elements in fullscreen: `#sidebar-box`, `#sidebar-main`, `#sidebar-splitter`, `#sidebar-launcher-splitter`.

---

## sidebar.css

Sidebar container and header.

| Variable                 | Controls                                |
| ------------------------ | --------------------------------------- |
| `--splitter-width`       | Sidebar splitter width                  |
| `--sidebar-border-color` | Sidebar border (also in browser-colors) |

Key IDs: `#sidebar-box`, `#sidebar-header`, `#sidebar`, `#sidebar-main`, `#sidebar-spacer`, `#sidebar-title`, `#sidebar-switcher-target`, `#sidebar-switcher-arrow`, `#sidebar-close`, `#sidebar-throbber`, `#sidebar-launcher-splitter`.

---

## contextmenu.css

Context menu navigation buttons.

Key IDs: `#context-navigation`, `#context-back`, `#context-forward`, `#context-reload`, `#context-stop`, `#context-bookmarkpage`.

Note: `#context-sep-navigation` is in browser.xhtml, not in CSS.

---

## identity-block/identity-block.css

Site identity and permission icons in the urlbar.

Key IDs: `#identity-box`, `#identity-icon`, `#identity-icon-label`, `#identity-permission-box`, `#permissions-granted-icon`, `#tracking-protection-icon`, `#tracking-protection-icon-box`, `#tracking-protection-icon-container`, `#notification-popup-box`, `#blocked-permissions-container`, `#urlbar-label-box`, `#urlbar-search-mode-indicator`, `#geo-sharing-icon`.

---

## searchbar.css

Standalone search bar (separate from urlbar).

Key IDs: `#PopupSearchAutoComplete`, `#searchbar`.

Uses `--panel-border-radius: var(--arrowpanel-border-radius)`.

Note: `.searchbar-engine-one-off-item` elements are NOT inside `#urlbar`.

---

## customizableui/panelUI-shared.css

App menu and panel-based popup styling. 2348 lines.

| Variable                                | Controls                                             |
| --------------------------------------- | ---------------------------------------------------- |
| `--panelui-subview-transition-duration` | Subview slide transition                             |
| `--menu-panel-width`                    | Menu panel width                                     |
| `--menu-panel-width-wide`               | Wide menu panel width                                |
| `--panel-separator-margin-vertical`     | Panel separator vertical margin                      |
| `--panel-separator-margin-horizontal`   | Panel separator horizontal margin                    |
| `--panel-separator-margin`              | Panel separator margin shorthand                     |
| `--panel-subview-body-padding-block`    | Subview body block padding                           |
| `--panel-subview-body-padding-inline`   | Subview body inline padding                          |
| `--panel-subview-body-padding`          | Subview body padding shorthand                       |
| `--panel-and-palette-icon-size`         | Icon size in panels                                  |
| `--panel-banner-item-color`             | Banner item text                                     |
| `--panel-banner-item-background-color`  | Banner item background                               |
| `--panel-banner-item-hover-bgcolor`     | Banner item hover                                    |
| `--panel-banner-item-active-bgcolor`    | Banner item active                                   |
| `--arrowpanel-menuitem-margin-inline`   | Panel menu item inline margin                        |
| `--arrowpanel-menuitem-padding-block`   | Panel menu item block padding                        |
| `--arrowpanel-header-back-icon-padding` | Back icon padding                                    |
| `--panel-background`                    | Panel background (aliases `--arrowpanel-background`) |
| `--panel-color`                         | Panel color (aliases `--arrowpanel-color`)           |
| `--panel-border-color`                  | Panel border (aliases `--arrowpanel-border-color`)   |

Key IDs: `#appMenu-bookmarks-button`, `#appMenu-fullscreen-button2`, `#appMenu-zoomEnlarge-button2`, `#appMenu-zoomReduce-button2`.

Key classes: `.panel-subview-body`, `.panel-header`, `.panel-banner-item`, `.subviewbutton`, `.subviewbutton-iconic`, `.subviewbutton-nav`, `.subviewbutton-back`, `.subviewradio`, `.panel-footer`.

---

## customizableui/panelUI.css

Minimal (14 lines). Platform-specific panel overrides.

---

## customizableui/customizeMode.css

Customize toolbar mode. 666 lines.

Key IDs: `#customization-container`, `#customization-palette`, `#customization-footer`, `#customization-header`.

---

## controlcenter/panel.css

Site identity popup, permissions, protections panel. 768 lines.

Key IDs: `#identity-popup`, `#permission-popup`, `#protections-popup`, `#blocked-popup-indicator-item`.

---

## addons/unified-extensions.css

Unified extensions panel.

| Variable                           | Controls                                             |
| ---------------------------------- | ---------------------------------------------------- |
| `--uei-icon-size`                  | Extension icon size (32px in panel, 24px in toolbar) |
| `--uei-attention-dot-size`         | Attention dot size                                   |
| `--uei-button-bgcolor`             | Extension button background                          |
| `--uei-button-color`               | Extension button text                                |
| `--uei-button-hover-bgcolor`       | Extension button hover background                    |
| `--uei-button-hover-color`         | Extension button hover text                          |
| `--uei-button-active-bgcolor`      | Extension button active background                   |
| `--uei-button-active-color`        | Extension button active text                         |
| `--uei-button-attention-dot-color` | Attention dot color                                  |

Key IDs: `#unified-extensions-panel`, `#unified-extensions-view`, `#unified-extensions-button`, `#unified-extensions-messages-container`.

---

## downloads/downloads.inc.css

Download panel rows.

Key IDs: `#downloadsListBox`, `#emptyDownloads`, `#downloadsPanel`, `#downloadsPanel-blockedSubview`, `#downloadsPanel-blockedSubview-title`.

Classes: `.downloadContainer`, `.downloadProgress`, `.downloadTypeIcon`, `.download-state`.

---

## downloads/indicator.css

Downloads toolbar button indicator animations.

Key IDs: `#downloads-button`, `#downloads-indicator-anchor`, `#downloads-indicator-icon`, `#downloads-indicator-progress-inner`, `#downloads-indicator-progress-outer`, `#downloads-indicator-finish-box`, `#downloads-indicator-start-box`.

---

## downloads/progressmeter.css

Download progress bar styling for `#downloadsListBox` and `#contentAreaDownloadsView`.

---

## downloads/allDownloadsView.inc.css

Full downloads view (about:downloads). Key ID: `#downloadsListBox`.

---

## downloads/contentAreaDownloadsView.css

Content area downloads page. Key IDs: `#contentAreaDownloadsView`, `#downloadsListBox`, `#downloadsListEmptyDescription`.

---

## light-dark-overrides.css

9 lines. Overrides `#urlbar` box variables to use `--toolbar-field-focus-background-color` and `--button-background-color*`.

---

## notification-icons.css

Permission and notification anchor icons in the urlbar.

Key IDs: `#notification-popup-box`, `#blocked-permissions-container`, `#password-notification-icon`, `#canvas-notification-icon`, `#eme-notification-icon`, `#webauthn-notification-icon`, `#webRTC-all-windows-shared`, `#webRTC-previewVideo`, `#webRTC-previewWarning`.

---

## addon-notification.css

Extension install/permission notification popups. 119 lines.

---

## formautofill-notification.css

Address/credit card autofill capture notifications.

Key IDs: `#address-capture-edit-address-button`, `#address-capture-menu-button`, various `#address-edit-*-input` fields.

---

## menupanel.css

Zoom and fullscreen buttons in app menu. Key IDs: `#appMenu-fullscreen-button2`, `#appMenu-zoomEnlarge-button2`, `#appMenu-zoomReduce-button2`.

---

## translations/panel.css

Full page and selection translations panels.

Key IDs: `#full-page-translations-panel-*`, `#select-translations-panel-*`.

---

## UITour.css

Firefox tour highlight and tooltip.

Key IDs: `#UITourHighlight`, `#UITourHighlightContainer`, `#UITourTooltipBody`, `#UITourTooltipTitle`, `#UITourTooltipDescription`, `#UITourTooltipButtons`, `#UITourTooltipClose`, `#UITourTooltipIcon`.

---

## places/editBookmark.css, places/editBookmarkPanel.css

Bookmark editor dialog and panel.

Key IDs: `#editBookmarkPanel`, `#editBookmarkPanelContent`, `#editBMPanel_folderMenuList`, `#editBMPanel_folderTree`, `#editBMPanel_tagsField`, `#editBMPanel_tagsSelector`, `#editBMPanel_namePicker`.

---

## places/organizer.css, places/organizer-shared.css

Library window (bookmark/history manager).

Key IDs: `#placesList`, `#placesView`, `#placesMenu`, `#placesToolbar`, `#contentView`, `#detailsPane`, `#infoBox`.

---

## places/sidebar.css

Bookmarks/history sidebar tree. Key IDs: `#sidebar-panel-header`, `#sidebar-search-container`, `#search-box`, `#viewButton`.

---

## places/tree-icons.css

Tree view icons for bookmarks/history/tags. No IDs or variables — icon list-style-image only.

---

## syncedtabs/sidebar.css

Synced tabs sidebar. 352 lines. No exported variables.

---

## privatebrowsing/aboutPrivateBrowsing.css

about:privatebrowsing page styling. Key IDs: `#info-body`, `#info-title`.

---

## tab-list-tree.css

Tab list tree view. 50 lines.

---

## autocomplete.css

Form autocomplete popup. Key ID: `#PopupAutoComplete`. 292 lines.

---

## pageInfo.css

Page info dialog. Key IDs: `#generalPanel`, `#mediaTab`, `#permTab`, `#securityBox`, `#imagetree`.

---

## webRTC-indicator.css

WebRTC sharing indicator window.

Key IDs: `#device-share`, `#display-share`, `#camera-mute-toggle`, `#microphone-mute-toggle`, `#window-controls`, `#minimize`, `#drag-indicator`.

---

## identity-credential-notification.css

Federated credential chooser notification. Key IDs: `#credential-chooser-notification`, `#identity-credential-notification`.

---

# Toolkit CSS

Path prefix: `chrome/toolkit/skin/classic/global/`

---

## global-shared.css

Base variables inherited by all chrome documents.

### Panels

| Variable                               | Controls                            |
| -------------------------------------- | ----------------------------------- |
| `--arrowpanel-background`              | Panel background (base: `Field`)    |
| `--arrowpanel-color`                   | Panel text (base: `FieldText`)      |
| `--arrowpanel-border-color`            | Panel border (base: `ThreeDShadow`) |
| `--arrowpanel-border-radius`           | Panel border radius (8px)           |
| `--arrowpanel-padding`                 | Panel padding (16px)                |
| `--arrowpanel-shadow-margin`           | Panel shadow margin                 |
| `--arrowpanel-dimmed`                  | Panel dimmed hover color            |
| `--arrowpanel-dimmed-further`          | Panel dimmed active color           |
| `--arrowpanel-menuitem-border-radius`  | Menu item border radius (4px)       |
| `--arrowpanel-menuitem-margin`         | Menu item margin                    |
| `--arrowpanel-menuitem-margin-block`   | Menu item block margin              |
| `--arrowpanel-menuitem-margin-inline`  | Menu item inline margin (8px)       |
| `--arrowpanel-menuitem-padding`        | Menu item padding                   |
| `--arrowpanel-menuitem-padding-block`  | Menu item block padding (8px)       |
| `--arrowpanel-menuitem-padding-inline` | Menu item inline padding (8px)      |
| `--panel-separator-color`              | Panel separator color               |

### Toolbar

| Variable                              | Controls                 |
| ------------------------------------- | ------------------------ |
| `--toolbar-bgcolor`                   | Toolbar background       |
| `--toolbar-color`                     | Toolbar text             |
| `--toolbar-color-scheme`              | Toolbar color scheme     |
| `--toolbarbutton-icon-fill`           | Icon fill (currentColor) |
| `--toolbarbutton-icon-fill-attention` | Attention icon fill      |
| `--toolbarbutton-disabled-opacity`    | Disabled button opacity  |

### Fields

| Variable                                 | Controls                 |
| ---------------------------------------- | ------------------------ |
| `--toolbar-field-background-color`       | Field background         |
| `--toolbar-field-color`                  | Field text               |
| `--toolbar-field-border-color`           | Field border             |
| `--toolbar-field-focus-background-color` | Focused field background |
| `--toolbar-field-focus-color`            | Focused field text       |
| `--toolbar-field-focus-border-color`     | Focused field border     |
| `--input-border-color`                   | Input border color       |

### Other

| Variable                          | Controls                      |
| --------------------------------- | ----------------------------- |
| `--default-focusring`             | Default focus ring            |
| `--default-focusring-width`       | Focus ring width (2px)        |
| `--animation-easing-function`     | Default animation easing      |
| `--menuitem-border-radius`        | Menu item border radius       |
| `--menuitem-margin`               | Menu item margin              |
| `--menuitem-padding`              | Menu item padding             |
| `--popup-notification-body-width` | Popup notification body width |

---

## popup.css

Popup/panel base styling.

| Variable                | Controls                        |
| ----------------------- | ------------------------------- |
| `--panel-background`    | Panel background (base: `Menu`) |
| `--panel-color`         | Panel text (base: `MenuText`)   |
| `--panel-padding`       | Panel padding                   |
| `--panel-padding-block` | Panel block padding (4px)       |
| `--panel-border-radius` | Panel border radius (6px)       |
| `--panel-border-color`  | Panel border color              |
| `--panel-width`         | Panel width                     |
| `--panel-shadow-margin` | Panel shadow margin (4px)       |
| `--panel-shadow`        | Panel box shadow                |

---

## menu.css

Native menu and context menu styling.

| Variable                   | Controls               |
| -------------------------- | ---------------------- |
| `--menu-icon-opacity`      | Menu icon opacity      |
| `--menu-arrow-size`        | Submenu arrow size     |
| `--menuitem-border-radius` | Menu item radius (3px) |
| `--menuitem-margin`        | Menu item margin       |
| `--menuitem-padding`       | Menu item padding      |

---

## findbar.css

Path: `chrome/toolkit/skin/classic/global/findbar.css`

Uses `xul|findbar` element selector.

Classes: `.findbar-container`, `.findbar-textbox`, `.findbar-find-previous`, `.findbar-find-next`, `.findbar-find-status`, `.found-matches`, `.findbar-closebutton`.

No `.findbar-highlight` class exists.

---

## notification.css

Notification bar. 20 lines. Minimal styling.

---

## popupnotification.css

Popup notification doorhanger. 138 lines.

---

## toolbar.css

Base toolbar element. 54 lines.

---

## toolbarbutton.css

Base toolbar button element. 99 lines.

---

## button.css

Base XUL button. 50 lines.

---

## arrowscrollbox.css

Scrollable container with arrow buttons. 61 lines.

---

## autocomplete.css (toolkit)

Base autocomplete popup. Uses `--panel-color: FieldText` and `--panel-background: Field`.

---

## richlistbox.css

Rich list box widget. 58 lines.

---

## tabbox.css

Tab box widget. 49 lines.

---

## splitter.css

Splitter widget. 70 lines.

---

## tree/tree.css

Tree view widget. 290 lines.

---

## in-content/common-shared.css

In-content page styling (about:preferences, about:addons, etc.). 1240 lines.

| Variable                           | Controls                 |
| ---------------------------------- | ------------------------ |
| `--in-content-page-color`          | Page text color          |
| `--in-content-page-background`     | Page background          |
| `--in-content-text-color`          | Text color               |
| `--in-content-box-border-color`    | Box border color         |
| `--in-content-box-info-background` | Info box background      |
| `--in-content-item-hover`          | Item hover background    |
| `--in-content-item-hover-text`     | Item hover text          |
| `--in-content-item-selected`       | Item selected background |
| `--in-content-item-selected-text`  | Item selected text       |
| `--in-content-border-invalid`      | Invalid border color     |

---

## design-system/tokens-shared.css

Design system tokens. 409 lines.

| Variable                           | Controls                 |
| ---------------------------------- | ------------------------ |
| `--background-color-box`           | Box background           |
| `--background-color-critical`      | Critical background      |
| `--background-color-information`   | Information background   |
| `--background-color-success`       | Success background       |
| `--background-color-warning`       | Warning background       |
| `--border-color`                   | Default border           |
| `--border-color-card`              | Card border              |
| `--border-color-interactive-hover` | Interactive hover border |

---

# DevTools CSS

Path prefix: `chrome/devtools/skin/`

Override DevTools variables in **userContent.css** using `:root.theme-dark` (or `:root.theme-light`).

---

## variables.css

DevTools theme variables. Key groups:

### Colors

| Variable                             | Controls               |
| ------------------------------------ | ---------------------- |
| `--theme-body-background`            | Main background        |
| `--theme-body-color`                 | Main text              |
| `--theme-body-emphasized-background` | Emphasized background  |
| `--theme-sidebar-background`         | Sidebar background     |
| `--theme-toolbar-background`         | Toolbar background     |
| `--theme-toolbar-background-hover`   | Toolbar hover          |
| `--theme-toolbar-color`              | Toolbar text           |
| `--theme-toolbar-separator`          | Toolbar separator      |
| `--theme-tab-toolbar-background`     | Tab toolbar background |
| `--theme-selection-background`       | Selection background   |
| `--theme-selection-color`            | Selection text         |
| `--theme-selection-background-hover` | Selection hover        |
| `--theme-selection-focus-background` | Selection focus        |

### Syntax highlighting

| Variable                        | Controls                  |
| ------------------------------- | ------------------------- |
| `--theme-highlight-blue`        | Blue highlight (keywords) |
| `--theme-highlight-purple`      | Purple highlight          |
| `--theme-highlight-pink`        | Pink highlight            |
| `--theme-highlight-red`         | Red highlight (errors)    |
| `--theme-highlight-orange`      | Orange highlight          |
| `--theme-highlight-lightorange` | Light orange              |
| `--theme-highlight-green`       | Green highlight (strings) |
| `--theme-highlight-bluegrey`    | Blue-grey highlight       |
| `--theme-highlight-yellow`      | Yellow highlight          |
| `--theme-highlight-gray`        | Gray highlight            |
| `--theme-comment`               | Comment color             |

### UI elements

| Variable                            | Controls                  |
| ----------------------------------- | ------------------------- |
| `--theme-icon-color`                | Icon default color        |
| `--theme-icon-dimmed-color`         | Icon dimmed color         |
| `--theme-icon-checked-color`        | Icon checked/active color |
| `--theme-icon-error-color`          | Icon error color          |
| `--theme-icon-warning-color`        | Icon warning color        |
| `--theme-link-color`                | Link color                |
| `--theme-internal-link-color`       | Internal link color       |
| `--theme-text-color-alt`            | Alt text color            |
| `--theme-text-color-strong`         | Strong text color         |
| `--theme-text-color-inactive`       | Inactive text color       |
| `--theme-text-color-error`          | Error text color          |
| `--theme-popup-background`          | Popup background          |
| `--theme-popup-color`               | Popup text                |
| `--theme-popup-border-color`        | Popup border              |
| `--theme-popup-dimmed`              | Popup dimmed              |
| `--theme-popup-hover-background`    | Popup hover               |
| `--theme-popup-hover-color`         | Popup hover text          |
| `--theme-splitter-color`            | Splitter color            |
| `--theme-emphasized-splitter-color` | Emphasized splitter       |
| `--theme-focus-outline-color`       | Focus outline             |

### Toolbar buttons

| Variable                                         | Controls                  |
| ------------------------------------------------ | ------------------------- |
| `--theme-toolbarbutton-background`               | Button background         |
| `--theme-toolbarbutton-color`                    | Button text               |
| `--theme-toolbarbutton-hover-background`         | Button hover              |
| `--theme-toolbarbutton-hover-color`              | Button hover text         |
| `--theme-toolbarbutton-checked-background`       | Button checked            |
| `--theme-toolbarbutton-checked-color`            | Button checked text       |
| `--theme-toolbarbutton-checked-hover-background` | Button checked hover      |
| `--theme-toolbarbutton-checked-hover-color`      | Button checked hover text |
| `--theme-toolbarbutton-active-background`        | Button active             |

### Sizing

| Variable                      | Controls                   |
| ----------------------------- | -------------------------- |
| `--theme-body-font-size`      | Body font size (11px)      |
| `--theme-code-font-size`      | Code font size (11px)      |
| `--theme-code-line-height`    | Code line height           |
| `--theme-toolbar-height`      | Toolbar height (24px)      |
| `--theme-toolbar-tall-height` | Tall toolbar height (28px) |
| `--theme-focus-outline-size`  | Focus outline size (2px)   |

### Status backgrounds

| Variable                           | Controls                 |
| ---------------------------------- | ------------------------ |
| `--theme-warning-background`       | Warning background       |
| `--theme-warning-color`            | Warning text             |
| `--theme-error-background`         | Error background         |
| `--theme-error-color`              | Error text               |
| `--theme-toolbar-error-background` | Toolbar error background |

---

# browser.xhtml

Path: `chrome/browser/content/browser/browser.xhtml`

The main browser chrome document. All IDs and classes listed below exist in this file.

## Key structural IDs

| ID                              | Element                    |
| ------------------------------- | -------------------------- |
| `#main-window`                  | Root window                |
| `#navigator-toolbox`            | Toolbox container          |
| `#toolbar-menubar`              | Menu bar                   |
| `#TabsToolbar`                  | Tabs toolbar               |
| `#nav-bar`                      | Navigation bar             |
| `#nav-bar-customization-target` | Nav bar customization area |
| `#PersonalToolbar`              | Bookmarks toolbar          |
| `#tabbrowser-tabbox`            | Tab box                    |
| `#tabbrowser-tabpanels`         | Tab panels                 |
| `#tabbrowser-tabs`              | Tab strip                  |
| `#tabbrowser-arrowscrollbox`    | Tab scrollbox              |

## Urlbar IDs

`#urlbar`, `#urlbar-container`, `#urlbar-background`, `#urlbar-input`, `#urlbar-input-container` (class), `#urlbar-go-button`, `#urlbar-search-button`, `#urlbar-revert-button`, `#urlbar-revert-button-container`, `#urlbar-zoom-button`, `#urlbar-label-box`, `#urlbar-scheme`, `#urlbar-placeholder`, `#urlbar-page-action-button`.

Search mode: `#urlbar-search-mode-indicator`, `#urlbar-search-mode-indicator-title`, `#urlbar-search-mode-indicator-close`, `#searchmode-switcher-chicklet`, `#searchmode-switcher-title`, `#searchmode-switcher-close`, `#searchmode-switcher-dropmarker`, `#urlbar-searchmode-switcher`.

## Identity/permissions IDs

`#identity-box`, `#identity-icon`, `#identity-icon-label`, `#identity-permission-box`, `#permissions-granted-icon`, `#tracking-protection-icon`, `#tracking-protection-icon-box`, `#tracking-protection-icon-container`, `#notification-popup-box`, `#blocked-permissions-container`.

Popups: `#identity-popup`, `#permission-popup`, `#protections-popup`.

## Sidebar IDs

`#sidebar-box`, `#sidebar-header`, `#sidebar`, `#sidebar-main`, `#sidebar-spacer`, `#sidebar-splitter`, `#sidebar-launcher-splitter`, `#sidebar-close`, `#sidebar-title`, `#sidebar-switcher-target`, `#sidebar-switcher-arrow`, `#sidebar-throbber`, `#sidebar-icon`, `#sidebar-close-button`.

## Downloads IDs

`#downloads-button`, `#downloadsPanel`, `#downloadsListBox`, `#emptyDownloads`, `#downloads-indicator-anchor`, `#downloads-indicator-icon`, `#downloads-indicator-progress-inner`, `#downloads-indicator-progress-outer`.

## Toolbar button IDs

`#back-button`, `#forward-button`, `#stop-reload-button`, `#reload-button`, `#stop-button`, `#home-button`, `#downloads-button`, `#library-button`, `#fullscreen-button`, `#find-button`, `#print-button`, `#new-tab-button`, `#tabs-newtab-button`, `#star-button-box`, `#star-button`, `#bookmarks-menu-button`, `#PanelUI-menu-button`, `#firefox-view-button`, `#fxa-toolbar-menu-button`, `#unified-extensions-button`, `#translations-button`, `#picture-in-picture-button`, `#reader-mode-button`.

## Panels

`#PanelUI-menu-button` → `#mainPopupSet`, `#widget-overflow`, `#pageActionPanel`, `#editBookmarkPanel`, `#full-page-translations-panel`, `#select-translations-panel`, `#unified-extensions-panel`, `#screenshotsPagePanel`, `#sharing-tabs-warning-panel`, `#downloads-button-autohide-panel`.

## Context menus

`#tabContextMenu`, `#toolbar-context-menu`, `#placesContext`, `#downloadsContextMenu`, `#pageActionContextMenu`, `#unified-extensions-context-menu`, `#sidebar-context-menu`.

Main context menu items use `#main-context-menu-*` prefix (not `#context-*`). The old `#context-navigation`, `#context-back`, `#context-forward`, `#context-reload`, `#context-stop`, `#context-bookmarkpage` IDs also exist.

## Key classes in browser.xhtml

| Class                                    | Element                           |
| ---------------------------------------- | --------------------------------- |
| `.tabbrowser-tab`                        | Tab element                       |
| `.tab-background`                        | Tab background                    |
| `.tab-content`                           | Tab content                       |
| `.tab-label`                             | Tab label                         |
| `.tab-close-button`                      | Tab close button                  |
| `.tab-throbber`                          | Tab loading indicator             |
| `.tab-drop-indicator`                    | Tab drop target                   |
| `.browser-toolbar`                       | Toolbar                           |
| `.browser-titlebar`                      | Titlebar                          |
| `.browser-toolbox-background`            | Toolbox background                |
| `.urlbar-input-container`                | Urlbar input container            |
| `.urlbar-page-action`                    | Page action button                |
| `.urlbar-icon`                           | Urlbar icon                       |
| `.toolbarbutton-1`                       | Standard toolbar button           |
| `.toolbarbutton-icon`                    | Toolbar button icon               |
| `.toolbarbutton-text`                    | Toolbar button text               |
| `.toolbarbutton-animatable-box`          | Animated toolbar button           |
| `.toolbar-items`                         | Toolbar items container           |
| `.titlebar-buttonbox-container`          | Window button container           |
| `.titlebar-button`                       | Window button (min/max/close)     |
| `.titlebar-close`                        | Close button                      |
| `.titlebar-max`                          | Maximize button                   |
| `.titlebar-min`                          | Minimize button                   |
| `.titlebar-restore`                      | Restore button                    |
| `.titlebar-spacer`                       | Titlebar spacer                   |
| `.bookmark-item`                         | Bookmark bar item                 |
| `.private-browsing-indicator-with-label` | Private indicator (class, NOT ID) |
| `.private-browsing-indicator-icon`       | Private indicator icon            |
| `.closing-tabs-spacer`                   | Closing tabs spacer               |
| `.tabs-alltabs-button`                   | All tabs button                   |
| `.panel-subview-body`                    | Panel subview body                |
| `.panel-header`                          | Panel header                      |
| `.panel-footer`                          | Panel footer                      |
| `.panel-banner-item`                     | Panel banner item                 |
| `.panel-arrow`                           | Panel arrow                       |
| `.subviewbutton`                         | Subview button                    |
| `.subviewbutton-iconic`                  | Subview iconic button             |
| `.subviewbutton-nav`                     | Subview nav button                |
| `.notification-anchor-icon`              | Notification anchor               |
| `.blocked-permission-icon`               | Blocked permission icon           |
| `.popup-notification-icon`               | Popup notification icon           |
| `.identity-popup-section`                | Identity popup section            |
| `.protections-popup-category`            | Protections popup category        |
| `.unified-extensions-list`               | Extensions list                   |
| `.widget-overflow-list`                  | Overflow list                     |
| `.cui-widget-panel`                      | Customizable UI panel             |
| `.animatable-menupopup`                  | Animatable popup                  |

## IDs that do NOT exist

`#pocket-button`, `#scrollbutton-up`, `#scrollbutton-down` — these are not in browser.xhtml. Scroll buttons are shadow DOM `::part()`.
