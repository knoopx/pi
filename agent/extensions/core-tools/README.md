# core-tools

Core filesystem utility tools shared across workflows.

## Tool

- `find`
  - Executes `fd` with glob matching.
  - Returns paths relative to the search directory.
  - Respects ignore rules from `.gitignore`.

## Behavior constraints

- Enforces a hard timeout (`1000ms`).
- Aborts if result count exceeds `1000`.
- Returns explicit abort messaging when pattern scope is too broad.

## Pattern behavior

- Patterns containing a path separator (`/` or `\\`) are matched against full paths (`fd --full-path`).
- Patterns without separators are matched as filename globs.
