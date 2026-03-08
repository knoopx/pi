# nomnoml

Local nomnoml renderer for quick diagram previews and exports.

## Tools

- `nomnoml-display`
  - Accepts `source` or `inputFile`.
  - Renders and attaches PNG preview.
- `nomnoml-render`
  - Renders inline `source`.
  - Optional `outputFile` saves SVG.
- `nomnoml-render-file`
  - Reads `inputFile`, renders diagram.
  - Optional `outputFile` saves SVG.

## Implementation behavior

- Source validation enforces XOR (`source` vs `inputFile`).
- Rendering uses `nomnoml.renderSvg`.
- PNG attachment is generated via `sharp` from SVG.
- `@`-prefixed paths are normalized before disk IO.

## Failure behavior

- Input validation failures return explicit error details.
- Abort signals return `Cancelled.` (no silent partial output).
