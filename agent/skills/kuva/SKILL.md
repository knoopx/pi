---
name: kuva
description: "Creates scientific plots from tabular data via the command line. Use when generating charts from CSV/TSV files, piping structured data to visualizations, or producing SVG/PNG/PDF figures without a GUI."
---

# Kuva — CLI Scientific Plotting

27 chart types from stdin, CSV, or TSV. Auto-detects delimiters and headers. Output defaults to SVG on stdout; `-o plot.svg` (or `.png`/`.pdf` with matching feature flags). `--terminal` renders inline with Unicode braille.

## Workflow / Commands

See individual references for chart-specific options:

- [basic charts](references/basic-charts.md) — scatter, line, bar, histogram, pie
- [distributions](references/distributions.md) — box, violin, strip, density, ridgeline
- [matrices and flows](references/matrices-flows.md) — heatmap, sankey, chord, upset
- [bioinformatics](references/bioinformatics.md) — volcano, manhattan, forest, candlestick

## DuckDB Pipeline Pattern

Query data with DuckDB, pipe CSV output to kuva. Use `read_csv_auto()` for TSV/CSV files, `-csv` flag for clean pipe output, redirect stderr with `2>/dev/null`.

```bash
# Filter and plot — scatter with regression on filtered rows
duckdb -csv 2>/dev/null \
  -c "SELECT temp, pressure FROM read_csv_auto('data.tsv') WHERE temp > 25" \
  | kuva scatter --x temp --y pressure --trend --correlation -o plot.svg

# Unpivot wide data into multiple line series
duckdb -csv 2>/dev/null \
  -c "SELECT month, 'revenue' AS metric, revenue AS val FROM read_csv_auto('data.tsv')
      UNION ALL SELECT month, 'expense', expense FROM read_csv_auto('data.tsv')
      ORDER BY month" \
  | kuva line --x month --y val --color-by metric --legend -o lines.svg

# Aggregate then plot — mean revenue by region per quarter
duckdb -csv 2>/dev/null \
  -c "SELECT region, quarter, AVG(revenue) AS avg_rev FROM read_csv_auto('sales.tsv') GROUP BY region, quarter" \
  | kuva bar --label-col region --value-col avg_rev --color-by quarter -o bars.svg

# Count occurrences from raw log data
duckdb -csv 2>/dev/null \
  -c "SELECT status FROM read_csv_auto('access.log.csv')" \
  | kuva bar --count-by status -o counts.svg
```

## Column References

- By header name: `--x temperature`, `--label-col study`
- By 0-based index: `--x 0`
- Override delimiter: `-d ,` or `-d $'\t'`
- First row is data (not headers): `--no-header`

## Shared Styling

All commands accept:

- `--theme light|dark|solarized|minimal`
- `--palette category10|wong|okabe-ito|pastel|bold|tol-bright|tol-muted|tol-light|ibm`
- `--cvd-palette deuteranopia|protanopia|tritanopia`
- `--x-label`, `--y-label`, `--ticks N`, `--no-grid`, `--log-x/y`
- `--interactive` — hover/click in SVG output

## Constraints

- `--color-by` overrides `--color`; `--count-by` ignores `--value-col`
- `--equation`/`--correlation` require `--trend` on scatter
- `--terminal` is incompatible with `-o` file output
- Column names with spaces need quoting: `--x "my column"`
- SVG is the default and always available; PNG/PDF require matching build features
