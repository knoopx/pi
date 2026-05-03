---
name: kuva
description: "Creates scientific plots from tabular data via the command line. Use when generating charts from CSV/TSV files, piping structured data to visualizations, or producing SVG/PNG/PDF figures without a GUI."
---

# Kuva — CLI Scientific Plotting

27 chart types from stdin, CSV, or TSV. Auto-detects delimiters and headers. Output defaults to SVG on stdout; `-o plot.svg` (or `.png`/`.pdf` with matching build features). `--terminal` renders inline with Unicode braille.

## Typical Pattern: DuckDB + Kuva Pipeline

Query data with DuckDB, pipe CSV output to kuva:

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

## Shared Styling Options

All chart types accept:

- `--theme light|dark|solarized|minimal`
- `--palette category10|wong|okabe-ito|pastel|bold`
- `--cvd-palette deuteranopia|protanopia|tritanopia`
- `--x-label`, `--y-label`, `--ticks N`, `--no-grid`, `--log-x/y`
- `--interactive` — hover/click in SVG output

## Constraints

- `--color-by` overrides `--color`; `--count-by` ignores `--value-col`
- `--equation`/`--correlation` require `--trend` on scatter
- `--terminal` is incompatible with `-o` file output
- Column names with spaces need quoting: `--x "my column"`

## Chart Types

Basic charts (scatter, line, bar, histogram, pie), distributions (box, violin, strip, density, ridgeline), matrices and flows (heatmap, sankey, chord, upset), bioinformatics (volcano, manhattan, forest, candlestick). See the references/ directory for chart-specific options.
