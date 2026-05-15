# Bioinformatics Charts

Volcano, manhattan, forest, phylo, synteny, ternary, polar. Data files in `../assets/`.

## Volcano Plot

Differential expression: log2FC vs -log10 p-value.

```bash
# Basic volcano plot with top-N labeling
duckdb -csv 2>/dev/null \
  -c "SELECT * FROM read_csv_auto('assets/degs.tsv')" \
  | kuva volcano --name-col gene --x-col log2fc --y-col pvalue --top-n 3 -o volcano.svg

# Custom significance cutoffs
kuva volcano assets/degs.tsv \
  --name-col gene --x-col log2fc --y-col pvalue \
  --fc-cutoff 1.5 --p-cutoff 0.01 -o volcano-custom.svg
```

Options: `--fc-cutoff`, `--p-cutoff`, `--top-n`, `--color-up`, `--color-down`.

## Manhattan Plot

GWAS results with chromosome positions.

```bash
# Basic Manhattan plot
duckdb -csv 2>/dev/null \
  -c "SELECT * FROM read_csv_auto('assets/gwas.tsv')" \
  | kuva manhattan --chr-col chr --pos-col position --pvalue-col pvalue -o manhattan.svg

# With genome build reference
kuva manhattan assets/gwas.tsv \
  --chr-col chr --pos-col position --pvalue-col pvalue \
  --genome-build hg38 --top-n 5 -o manhattan-hg38.svg
```

Options: `--genome-build hg19|hg38|t2t`, `--genome-wide`, `--suggestive`, `--top-n`.

## Forest Plot

Point estimates with confidence intervals on categorical y-axis.

```bash
# Basic forest plot from meta-analysis data
duckdb -csv 2>/dev/null \
  -c "SELECT * FROM read_csv_auto('assets/mets.tsv')" \
  | kuva forest --label-col study --estimate-col estimate \
      --ci-lower-col ci_lower --ci-upper-col ci_upper -o forest.svg

# With weight column for marker sizing
kuva forest assets/mets.tsv \
  --label-col study --estimate-col estimate \
  --ci-lower-col ci_lower --ci-upper-col ci_upper \
  --weight-col n --null-value 1.0 -o forest-weighted.svg
```

Options: `--weight-col`, `--color`, `--marker-size`, `--whisker-width`, `--null-value`.

## Candlestick / OHLC

Financial candlestick chart.

```bash
kuva candlestick assets/ohlc.tsv \
  --open-col open --high-col high --low-col low --close-col close -o candle.svg
```

## Polar Plot

Polar coordinate scatter or line.

```bash
kuva polar assets/polar.tsv --radius-col dist --angle-col theta -o polar.svg
```

## Ternary Plot

Barycentric coordinates (A + B + C = 1).

```bash
kuva ternary assets/ternary.tsv --a-col comp_a --b-col comp_b --c-col comp_c -o ternary.svg
```

## Phylogenetic Tree

From Newick string or edge list.

```bash
# From Newick string via stdin
echo "(A:0.1,B:0.2,(C:0.3,D:0.4):0.5);" | kuva phylo -o tree.svg

# From edge list file
kuva phylo edges.tsv --parent-col parent --child-col child --length-col dist -o tree-edges.svg
```

## Synteny

Genome synteny ribbons from sequence and block files.

```bash
kuva synteny --sequence seqs.tsv --blocks blocks.tsv -o synteny.svg
```
