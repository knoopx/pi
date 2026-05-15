# Kuva Chart Reference

## Chart Types & Required Flags

| Chart        | Command          | Required Args                | Notes                                                                               |
| ------------ | ---------------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| Bar chart    | `kuva bar`       | `--label-col`, `--value-col` | Use `--count-by` to count occurrences, or `--agg sum/mean/median` with `--color-by` |
| Pie chart    | `kuva pie`       | `--label-col`, `--value-col` | Pre-aggregated data only (no --agg); use `--palette` and `--legend`                 |
| Histogram    | `kuva histogram` | (first column is data)       | Use `--bins N`, `--value-col` to pick a specific column                             |
| Line chart   | `kuva line`      | `--x`, `--y`                 | Expects numeric x-axis; use `--fill` for area fill, `--color-by` for multi-series   |
| Scatter plot | `kuva scatter`   | `--x`, `--y`                 | Use `--trend` for regression line                                                   |
| Box plot     | `kuva box`       | `--group-col`, `--value-col` | Use `--overlay-points` or `--overlay-swarm`                                         |
| Violin plot  | `kuva violin`    | `--group-col`, `--value-col` | Density visualization grouped by column                                             |
| Strip plot   | `kuva strip`     | `--group-col`, `--value-col` | Individual data points per group; file input only (no pipe); no --color-by          |
| Density      | `kuva density`   | `--value`                    | KDE curve; use `--filled` for area fill, `--color-by` to group                      |

**Parameter naming varies by chart type**: bar/box/violin/strip use `--label-col` or `--group-col`; histogram uses `--value-col`; density/line/scatter use `--value`, `--x`, `--y`. Check `--help` for the specific chart.

## Examples

### Bar chart — count occurrences

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva bar --label-col Vendor --value-col cnt \
  --theme dark --color "#fad000" --background "#191033" \
  --title 'Transactions by Vendor' \
  -o payment.png
SELECT Vendor, COUNT(*) AS cnt FROM read_csv('data.csv', header=true, ignore_errors=true) GROUP BY Vendor ORDER BY cnt DESC;
EOF
```

### Pie chart — pre-aggregated via DuckDB (no --agg support in kuva pie)

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva pie --label-col Vendor --value-col total \
  --theme dark --palette okabe-ito --background "#191033" \
  --title 'Top Spending Vendors' --legend \
  -o pie.png
SELECT Vendor, SUM(CAST(Amount AS DOUBLE)) AS total FROM read_csv('data.csv', header=true, ignore_errors=true) GROUP BY Vendor ORDER BY total DESC LIMIT 10;
EOF
```

### Histogram

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva histogram --value-col Amount --bins 30 \
  --theme dark --color "#fad000" --background "#191033" \
  --title 'Amount Distribution' --x-label 'Amount (€)' \
  -o histogram.png
SELECT CAST(Amount AS DOUBLE) AS Amount FROM read_csv('data.csv', header=true, ignore_errors=true);
EOF
```

### Box plot — grouped by vendor

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva box --group-col Vendor --value-col Amount \
  --theme dark --overlay-points --background "#191033" \
  --title 'Spending Distribution' --x-label 'Vendor' --y-label 'Amount (€)' \
  -o boxplot.png
SELECT Vendor, CAST(Amount AS DOUBLE) AS Amount FROM read_csv('data.csv', header=true, ignore_errors=true);
EOF
```

### Density plot — filled KDE

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva density --value Amount \
  --theme dark --filled --background "#191033" \
  --title 'Purchase Amount Density' --x-label 'Amount (€)' \
  -o density.png
SELECT CAST(Amount AS DOUBLE) AS Amount FROM read_csv('data.csv', header=true, ignore_errors=true);
EOF
```

### Line chart — time series (numeric x-axis required)

Convert dates to month numbers (`year*12+month`) in DuckDB since kuva's line chart expects numeric x:

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva line --x month_num --y total \
  --theme dark --color "#fad000" --background "#191033" \
  --fill --title 'Monthly Spending' --x-label 'Month' --y-label 'Total (€)' \
  -o line.png
SELECT (STRFTIME(CAST(DATE_TRUNC('month', CAST(Date AS DATE)) AS DATE), '%Y')::INT * 12 + STRFTIME(CAST(DATE_TRUNC('month', CAST(Date AS DATE)) AS DATE), '%m')::INT) AS month_num, SUM(CAST(Amount AS DOUBLE)) AS total FROM read_csv('data.csv', header=true, ignore_errors=true) GROUP BY month_num ORDER BY month_num;
EOF
```

### Violin plot — by tag

```bash
duckdb :memory: -csv << 'EOF' 2>/dev/null | kuva violin --group-col Tags --value-col Amount \
  --theme dark --palette okabe-ito --background "#191033" \
  --title 'Spending by Category' --x-label 'Tag' --y-label 'Amount (€)' \
  -o violin.png
SELECT Tags, CAST(Amount AS DOUBLE) AS Amount FROM read_csv('data.csv', header=true, ignore_errors=true);
EOF
```

### Strip plot — individual purchases per vendor

File input only (no pipe support); single color via `--color` (no `--color-by`).

```bash
kuva strip --group-col Vendor --value-col Amount \
  --theme dark --color "#fad000" --background "#191033" \
  --title 'Individual Purchases' --x-label 'Vendor' --y-label 'Amount (€)' \
  -o strip.png data.csv
```
