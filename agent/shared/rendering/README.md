# renderers

Shared formatting primitives used across extensions.

## Public tool

### `render-data`

Pretty-prints nested objects/arrays/tables.

- Input: arbitrary `data`
- Optional: `width` (40-500)
- Implementation: `nu -c "$env.NU_DATA | from json | table ..."`

## Exported helpers

- Header/text: `dotJoin`, `sectionDivider`, `threadSeparator`, `stateDot`, `passFail`, `countLabel`
- Tables/details: `table`, `detail`
- Action lines: `actionLine`

## Notes

- This extension is both:
  - a reusable library module for sibling extensions, and
  - a standalone formatting tool (`render-data`).
- `render-data` fails loudly if `nu` is unavailable or command execution fails.
