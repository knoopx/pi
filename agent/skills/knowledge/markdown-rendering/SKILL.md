---
name: markdown-rendering
description: "Renders markdown to self-contained HTML with a custom dark stylesheet and opens in browser. Use when previewing markdown documents, generating styled HTML from README or report files."
keywords:
  ["markdown", "html", "render", "preview", "pandoc", "browser", "document"]
related: [bash]
---

## Markdown Rendering

Convert any markdown file to a styled, self-contained HTML document and open it in the default browser.

### Quick render (existing file)

```bash
nix run nixpkgs#pandoc -- \
  --from=markdown-implicit_figures --to=html --embed-resources --standalone \
  --css="$HOME/.pi/agent/skills/knowledge/markdown-rendering/assets/style.css" \
  input.md -o output.html && xdg-open output.html
```

### Quick render (piped stdin — no temp file)

Pandoc accepts `-` as the input filename to read from stdin. Use this when generating markdown on the fly:

```bash
echo '# Hello World' | nix run nixpkgs#pandoc -- \
  --from=markdown-implicit_figures --to=html --embed-resources --standalone \
  --css="$HOME/.pi/agent/skills/knowledge/markdown-rendering/assets/style.css" \
  - -o output.html && xdg-open output.html
```

## Stylesheet

The stylesheet lives at `assets/style.css` and is derived from `~/.nix/modules/nixos/defaults/colors.nix` (base16 palette). It provides:

- Dark background (`#191033`) with light text (`#f8f8f8`)
- Yellow accents on headings (`#fad000`)
- Cyan links (`#80fcff`) and green code strings (`#a5ff90`)
- Styled tables, blockquotes, code blocks, and horizontal rules

## Constraints

- Always use `nix run nixpkgs#pandoc` — do not assume pandoc is on PATH
- Always pass `--embed-resources --standalone` so the HTML is fully portable (no external CSS/JS dependencies)
- Always pass `--css=<path>` pointing to `assets/style.css` for consistent styling
- Always open with `xdg-open` after rendering — the user expects to see the result
- Pipe generated markdown via stdin (`-`) instead of writing a temp file — pandoc reads stdin natively
