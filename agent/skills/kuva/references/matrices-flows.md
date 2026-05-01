# Matrices and Flows

Heatmap, sankey, chord, upset, waterfall, stacked-area. Data files in `../assets/`.

## Heatmap

Wide matrix (first column = row labels) or long-format triples.

```bash
# Wide matrix with custom colormap
duckdb -csv 2>/dev/null \
  -c "SELECT * FROM read_csv_auto('assets/matrix.tsv')" \
  | kuva heatmap --colormap inferno --legend "Expression" -o heat.svg

# Print numeric values in each cell
kuva heatmap assets/matrix.tsv --values --colormap grayscale -o heat-val.svg

# Long format: (row, col, value) triples from query
duckdb -csv 2>/dev/null \
  -c "SELECT gene AS row, sample AS col, expr AS val FROM read_csv_auto('assets/heatmap-long.tsv')" \
  | kuva heatmap --long-format --row-col row --col-col col --value-col val -o heat-long.svg
```

Options: `--colormap viridis|inferno|grayscale`, `--values` (print cell values), `--legend "label"`, `--long-format`.

## Sankey

Source, target, value flow diagram.

```bash
# Basic Sankey from three columns
duckdb -csv 2>/dev/null \
  -c "SELECT * FROM read_csv_auto('assets/flows.tsv')" \
  | kuva sankey --source-col source --target-col target --value-col value -o sankey.svg

# Gradient links with flow labels
kuva sankey assets/flows.tsv \
  --source-col source --target-col target --value-col value \
  --link-gradient --flow-labels --opacity 0.6 -o sankey-detailed.svg
```

Options: `--link-gradient`, `--opacity`, `--flow-labels`, `--flow-percent`, `--flow-label-format auto|sci|integer|fixed2`, `--flow-label-unit`.

## Chord

N×N flow matrix as circular diagram.

```bash
kuva chord assets/adj.tsv -o chord.svg
```

## UpSet

Binary set-membership columns into intersection plot.

```bash
kuva upset assets/sets.tsv --title "Set Intersections" -o upset.svg
```

## Waterfall

Cumulative deltas with labels.

```bash
kuva waterfall assets/changes.tsv --label-col item --value-col delta -o waterfall.svg
```

## Stacked Area

Stacked area from x, group, y columns.

```bash
kuva stacked-area assets/stacked.tsv --x-col time --group-col category --y-col value -o stacked.svg
```
