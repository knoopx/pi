# Distributions

Box, violin, strip, density, and ridgeline plots. All take a group column and value column. Data files in `../assets/`.

## Box Plot

Box-and-whisker grouped by category. Overlay raw points on top.

```bash
# Basic box plot grouped by class
kuva box assets/scores.tsv --group-col class --value-col score -o box.svg

# Jittered individual points overlaid
duckdb -csv 2>/dev/null \
  -c "SELECT * FROM read_csv_auto('assets/scores.tsv') ORDER BY class" \
  | kuva box --group-col class --value-col score --overlay-points -o box-points.svg

# Beeswarm (non-overlapping) points
kuva box assets/scores.tsv --group-col class --value-col score --overlay-swarm -o swarm.svg
```

Options: `--overlay-points` (jittered), `--overlay-swarm` (beeswarm), `--group-colors "c1,c2,c3"`.

## Violin Plot

Kernel density mirror per group.

```bash
# Violin grouped by class
duckdb -csv 2>/dev/null \
  -c "SELECT * FROM read_csv_auto('assets/scores.tsv')" \
  | kuva violin --group-col class --value-col score -o violin.svg
```

## Strip / Beeswarm

Individual points grouped by category.

```bash
kuva strip assets/scores.tsv --group-col class --value-col score -o strip.svg
```

## Density

Smooth KDE curve of a single numeric column.

```bash
# Density from filtered data
duckdb -csv 2>/dev/null \
  -c "SELECT score AS value FROM read_csv_auto('assets/scores.tsv')" \
  | kuva density -o density.svg
```

## Ridgeline

Stacked KDE curves, one per group (joyplot).

```bash
kuva ridgeline assets/scores.tsv --group-col class --value-col score -o ridge.svg
```
