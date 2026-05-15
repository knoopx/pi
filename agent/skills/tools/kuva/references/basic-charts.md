# Basic Charts

Scatter, line, bar, histogram, and pie charts. Data files in `../assets/`.

## Scatter

Two numeric columns. Add regression with `--trend`.

```bash
# Filter rows, add trend line and R²
duckdb -csv 2>/dev/null \
  -c "SELECT temp, pressure FROM read_csv_auto('assets/scatter.tsv') WHERE temp > 25" \
  | kuva scatter --x temp --y pressure --trend --correlation -o scatter.svg

# Color points by group with legend
duckdb -csv 2>/dev/null \
  -c "SELECT sepal_length AS x, sepal_width AS y, species FROM read_csv_auto('assets/species.tsv')" \
  | kuva scatter --x x --y y --color-by species --legend -o species.svg

# Log-scale Y axis with fixed range
kuva scatter assets/scatter.tsv --x temp --y pressure --log-y --y-min 1000 -o log.svg
```

## Line

Ordered or time-series data. Multiple series via `--color-by`.

```bash
# Single line from ordered data
duckdb -csv 2>/dev/null \
  -c "SELECT month, revenue FROM read_csv_auto('assets/revenue.tsv') ORDER BY month" \
  | kuva line --x month --y revenue --title "Monthly Revenue" -o revenue.svg

# Two series via DuckDB unpivot
duckdb -csv 2>/dev/null \
  -c "SELECT month, 'revenue' AS metric, revenue AS val FROM read_csv_auto('assets/revenue.tsv')
      UNION ALL SELECT month, 'expense', expense FROM read_csv_auto('assets/revenue.tsv')
      ORDER BY month" \
  | kuva line --x month --y val --color-by metric --legend -o lines.svg

# Filled area under line
kuva line assets/revenue.tsv --fill -o filled.svg
```

Options: `--fill`, `--dashed`, `--dotted`, `--stroke-width`, `--legend`.

## Bar

Label + value pairs. Use `--count-by` to count occurrences or `--agg` to aggregate repeated labels.

```bash
# Simple bar from label/value columns
kuva bar assets/status.tsv --label-col status --value-col count -o status.svg

# Aggregate revenue by region and quarter (grouped bars)
duckdb -csv 2>/dev/null \
  -c "SELECT region, quarter, AVG(revenue) AS avg_rev FROM read_csv_auto('assets/sales.tsv') GROUP BY region, quarter" \
  | kuva bar --label-col region --value-col avg_rev --color-by quarter -o sales.svg

# Count occurrences of each value in a column
duckdb -csv 2>/dev/null \
  -c "SELECT status FROM read_csv_auto('assets/status-count.tsv')" \
  | kuva bar --count-by status -o counts.svg

# Build-in aggregation (mean, median, sum, min, max)
kuva bar assets/sales.tsv --label-col region --value-col revenue --agg mean -o agg.svg
```

Options: `--agg mean|median|sum|min|max`, `--color`, `--bar-width`, `--count-by`. Bar does not support `--legend`.

## Histogram

Single numeric column. Default 10 bins.

```bash
# Basic histogram from filtered scores
duckdb -csv 2>/dev/null \
  -c "SELECT score FROM read_csv_auto('assets/scores.tsv') WHERE score > 70" \
  | kuva histogram --bins 8 -o hist.svg

# Normalized probability density
kuva histogram assets/values.tsv --bins 15 --normalize -o density.svg
```

Options: `--bins N`, `--normalize` (probability density), `--color`.

## Pie / Donut

Proportions from label + value columns.

```bash
# Pie with percentages on labels
kuva pie assets/share.tsv --percent -o pie.svg

# Donut chart with inner radius
duckdb -csv 2>/dev/null \
  -c "SELECT * FROM read_csv_auto('assets/share.tsv') WHERE value > 5" \
  | kuva pie --donut --inner-radius 60 --percent -o donut.svg

# Count mode (no value column)
kuva pie assets/status-count.tsv --count-by status -o count-pie.svg
```

Options: `--donut`, `--inner-radius`, `--percent`, `--label-position inside|outside|none`, `--color-col`.
