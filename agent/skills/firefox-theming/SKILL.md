---
name: firefox-theming
description: Writes and audits Firefox userChrome.css and userContent.css against actual Firefox source CSS. Use when editing Firefox chrome styles, fixing dead selectors, or adding missing CSS variable overrides.
---

# Firefox Theming

## Source of Truth

Firefox ships its CSS inside `omni.ja` (a zip file). Always extract and read the relevant source files before writing or auditing userChrome rules.

### Extract source CSS

```bash
OMNI=$(ls /nix/store/*firefox-unwrapped*/lib/firefox/browser/omni.ja 2>/dev/null | head -1)
OMNI_TK=$(ls /nix/store/*firefox-unwrapped*/lib/firefox/omni.ja 2>/dev/null | head -1)
DEST=/tmp/ff-omni

mkdir -p "$DEST" && cd "$DEST"
unzip -o "$OMNI" "chrome/browser/skin/classic/browser/*.css" "chrome/browser/skin/classic/browser/**/*.css" 2>/dev/null
unzip -o "$OMNI_TK" "chrome/toolkit/skin/classic/global/*.css" 2>/dev/null
```

### Extract XUL for element IDs

```bash
unzip -o "$OMNI" "chrome/browser/content/browser/browser.xhtml" 2>/dev/null
```

Verify element existence with `grep 'id="element-id"' browser.xhtml`.

## Key source files

See [references/source-map.md](references/source-map.md) for file-to-section mapping.

## Workflow

1. **Extract** source CSS from omni.ja
2. **Read** the relevant source file for the section being edited
3. **Verify** every selector targets elements/classes/IDs that exist in source CSS or browser.xhtml
4. **Verify** every CSS variable override matches a variable defined in source
5. **Use variables** over direct property overrides when the source uses variables
6. **Remove** rules that match nothing

## DevTools theming

Override DevTools variables in **userContent.css** using `:root.theme-dark` (or `:root.theme-light`). DevTools adds these classes to its document root via `theme-switching.js`.

- Do NOT use `@-moz-document url-prefix("chrome://devtools/content/")` — it doesn't match DevTools documents in either userChrome or userContent
- Do NOT put DevTools overrides in userChrome.css — DevTools runs in a separate iframe with its own document
- Variables are defined in `chrome/devtools/skin/variables.css` (extract from browser omni.ja)
- Reference implementation: [one-monokai-firefox-devtools](https://github.com/benfaerber/one-monokai-firefox-devtools)

## Search mode indicators

Firefox has two search mode indicator systems. Hide both when removing the chip:

- **Legacy:** `#urlbar-search-mode-indicator` — shown via `#urlbar[searchmode] > .urlbar-input-container > #urlbar-search-mode-indicator`
- **Scotch Bonnet:** `#searchmode-switcher-chicklet` — shown via `#urlbar[searchmode] #searchmode-switcher-chicklet` (gated behind `browser.urlbar.scotchBonnet.enableOverride` or `browser.urlbar.searchModeSwitcher.featureGate`)
- Related elements: `#urlbar-searchmode-switcher`, `#searchmode-switcher-title`, `#searchmode-switcher-close`, `#searchmode-switcher-dropmarker`
- Source: `urlbar-searchbar.css`

## When CSS doesn't work

Search online for working reference implementations before guessing at more approaches. One working example beats ten theories.

## Common mistakes

- `#id` vs `.class` — check source (e.g. `.private-browsing-indicator-with-label` is a class, not an ID)
- Shadow DOM parts like `scrollbutton-up` are `::part()`, not IDs
- `tab` bare element doesn't match — Firefox uses `.tabbrowser-tab`
- Pseudo-elements (`::before`, `::after`) — verify they exist in source before targeting
- Border/separator overrides — find which element actually has the border (e.g. `.urlbarView-body-inner`, not `.urlbarView-body-outer`)
- Searchbar elements (`.searchbar-engine-one-off-item`) are not inside `#urlbar`
