---
name: kuva
description: "Create CLI plots from tabular data — 27 chart types from stdin/CSV/TSV. Use when generating bar, line, scatter, or box charts from DuckDB pipe output."
token_cost: 350
related: [duckdb]
keywords: ["kuva", "plot", "chart", "histogram", "scatter"]
---

# Kuva — CLI Scientific Plotting

27 chart types from stdin, CSV, or TSV. Output format is inferred from `-o` extension: `.png`, `.svg`, or `.pdf`.

## Workflow — Always Show Plots

**Every generated plot MUST be shown to the user.** Never generate a plot and silently save it.

**Save plots to `/tmp` by default.** Never write plots to the current working directory unless the user explicitly requests it.

### Single Plot

1. Run `kuva ... -o /tmp/plot.png`
2. **Immediately** call `read /tmp/plot.png` to show the user
3. If the plot looks wrong, regenerate with corrected parameters
4. Only proceed once the user has seen the output

### Multiple Plots

When rendering several plots:

1. Generate **all** plots first (e.g., `kuva ... -o /tmp/plot1.png`, then `kuva ... -o /tmp/plot2.png`, etc.)
2. Then show them **all together** in a single batch using the `read` tool (e.g., `read /tmp/plot1.png` followed by `read /tmp/plot2.png`)
3. If any plot looks wrong, regenerate only that one, then re-show all plots again
4. Only proceed once the user has seen every output

## Input Method — Always Use DuckDB Pipe

**Always prefer DuckDB pipe over file input.** Kuva reads CSV directly via positional argument, but DuckDB gives you `ignore_errors=true` for messy data, `CAST`/aggregations on the fly, and no intermediate files. When piping, do NOT pass a file argument to kuva (it will read the file instead of stdin).

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva bar --label-col Vendor --value-col cnt \
  --theme dark --color "#fad000" --background "#191033" \
  --title 'Vendor Counts' -o plot.png
SELECT Vendor, COUNT(*) AS cnt FROM read_csv('data.csv', header=true, ignore_errors=true) GROUP BY Vendor ORDER BY cnt DESC;
EOF
```

### DuckDB Gotchas

- Columns with mixed empty strings and numeric values cause `CAST` failures. Filter non-numeric rows: `WHERE col != '' AND col NOT LIKE '%—%'`.
- Column names with spaces require double quotes: `"Payment Method"`.
- Use heredoc (`<< 'EOF' ... EOF`) with duckdb for complex queries — `-c` struggles with quoting.
- Strip plot does NOT support pipe input (no stdin) — use file input for `kuva strip` only.
- Suppress DuckDB's resource warnings with `2>/dev/null` so kuva receives clean CSV on stdin.

## Quick Reference

See [chart reference](references/CHARTS.md) for full chart type table, parameter naming, and examples.

## Coloring

**Single-color charts**: `--color "#hex"` sets all bars/elements to one color. Works on bar, histogram, box, violin, strip.

**Strip plot caveat**: Does NOT support `--color-by` — use `--color` for a single fill, or switch to `kuva violin` / `kuva box` with `--color-by` if per-group coloring is needed.

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva bar --label-col x --value-col y --color "#fad000" \
  --theme dark --background "#191033" -o plot.png
SELECT x, CAST(y AS DOUBLE) AS y FROM read_csv('data.csv', header=true, ignore_errors=true);
EOF
```

**Multi-series charts**: `--color-by column` + `--palette name`. Palette cycles per series. Not all chart types support `--color-by` — check `--help`.
Available palettes: `category10`, `wong`, `okabe-ito`, `pastel`, `bold`, `tol-bright`, `tol-muted`, `tol-light`, `ibm`

**Pie charts**: use `--palette` (it overrides `--color`). No per-slice color control via CLI.

**Custom background**: `--background "#191033"` overrides the theme's canvas color.

**No custom themes via CLI.** Only 4 built-in: `light`, `dark`, `solarized`, `minimal`. Use these defaults:

| kuva flag      | Your palette value        | Usage                            |
| -------------- | ------------------------- | -------------------------------- |
| `--background` | `#191033` (base00)        | Canvas background for all charts |
| `--color`      | `#fad000` (base0A/yellow) | Default bar/histogram fill color |
| `--theme`      | `dark`                    | Dark theme as base               |

Example: `kuva bar --label-col x --value-col y --theme dark --color "#fad000" --background "#191033" -o plot.png`

## Shared Styling Options

All chart types accept:

- `--theme light|dark|solarized|minimal`
- `--palette category10|wong|okabe-ito|pastel|bold|tol-bright|tol-muted|tol-light|ibm`
- `--cvd-palette deuteranopia|protanopia|tritanopia` (overrides --palette)
- `--background <CSS>` — canvas background color
- `--x-label`, `--y-label`, `--ticks N`, `--no-grid`, `--log-x/y`
- `--interactive` (SVG only), `--width`, `--height`, `--scale`, `--title`

Bar chart extras: `--bar-width`, `--agg sum|mean|median|min|max`, `--count-by column`

## Constraints & Gotchas

- `--color-by` overrides `--color`; `--count-by` ignores `--value-col`
- `--palette` overrides `--color` on pie charts and multi-series charts
- `--terminal` is incompatible with `-o` file output
- Column names with spaces need quoting: `--x "my column"`
- **Pie chart does not support --agg** — must pre-aggregate via DuckDB (`SUM`, `GROUP BY`, etc.)
- **Line chart requires numeric x-axis** — convert dates in DuckDB (e.g., `year*12+month`)
- **When piping from DuckDB, do NOT pass a file argument to kuva** — it will read the file instead of stdin

## Chart Types

27 chart types: scatter, line, bar, histogram, pie, box, violin, strip, density, ridgeline, heatmap, sankey, chord, upset, volcano, manhattan, forest, candlestick. Check `kuva <chart> --help`.

## Full Examples

See [chart examples](references/CHARTS.md) for complete working examples for each chart type.
