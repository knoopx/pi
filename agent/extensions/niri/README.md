# niri

Niri compositor integration (`niri msg` wrappers).

## Tool coverage

### Query

- `niri-windows`
- `niri-focused-window`
- `niri-focused-output`
- `niri-outputs`
- `niri-workspaces`

### Interactive pickers

- `niri-pick-window`
- `niri-pick-color`

### Screenshots

- `niri-screenshot-screen`
- `niri-screenshot-window`

## Implementation details

- Query/picker tools call `niri msg -j ...`, parse JSON, then format output.
- Screenshot tools call `niri msg action ...` using argument builders in `args.ts`.
- Non-zero `niri` exit code is returned as tool error with stderr/stdout text.

## Notes

- Screenshot tools support clipboard-only or disk writes depending on flags.
- `niri-screenshot-window` can target explicit window IDs from `niri-windows`.
