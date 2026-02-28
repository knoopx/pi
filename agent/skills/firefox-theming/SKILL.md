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

Search online for working reference implementations before guessing. One working example beats ten theories.

## Common mistakes

- `#id` vs `.class` — check source (e.g. `.private-browsing-indicator-with-label` is a class, not an ID)
- Shadow DOM parts (`scrollbutton-up`, `scrollbutton-down`) are `::part()`, not IDs
- `tab` bare element doesn't match — use `.tabbrowser-tab`
- Pseudo-elements (`::before`, `::after`) — verify they exist in source before targeting
- Border/separator overrides — find which element has the border (e.g. `.urlbarView-body-inner`, not `.urlbarView-body-outer`)
- `.searchbar-engine-one-off-item` is not inside `#urlbar`
- `#context-sep-navigation` is in browser.xhtml, not in CSS
- `#pocket-button`, `#scrollbutton-up`, `#scrollbutton-down` do not exist in browser.xhtml
