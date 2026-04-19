# Real-World Usage Patterns

## Conditional Updates by Field Value

Update specific rows based on a field match. Use `$row.field` inside closures for clarity:

```nu
# Update specific rows based on title match (one at a time to avoid bash quoting issues)
open "data.csv"
| update Description { |row|
    if $row.Title == "Parc Sant Salvador" {
        "New description here"
    } else {
        $row.Description  # Keep original
    }
}
| collect | save --force "data.csv"

# For multiple entries, run separate update commands:
# nu -c 'open "data.csv" | update col { |row| if $row.Title == "A" { "Desc A" } else { $row.col } } | collect | save --force "data.csv"'
# nu -c 'open "data.csv" | update col { |row| if $row.Title == "B" { "Desc B" } else { $row.col } } | collect | save --force "data.csv"'
```

## Multi-Condition Updates

Handle duplicate values with additional conditions. Use parentheses for complex `where` clauses:

```nu
open "data.csv"
| update Description { |row|
    if ($row.Title == "El Patio" and ($row.Address | str contains "Sevilla")) {
        "Specific description for this location"
    } else {
        $row.Description
    }
}
| collect | save --force "data.csv"
```

## Extract Specific Data with Counts

```nu
# Get all unique categories with counts, sorted by count descending
open products.csv | get category | uniq --count | sort-by count --reverse

# Find top 10 by value
open sales.csv | sort-by amount --reverse | first 10 | select name amount

# Filter by multiple conditions (chained where)
open users.csv | where status == "active" | where last_login > "2024-01-01"
```

## Complete ETL Pipeline

A full extract-transform-load pipeline in one chain:

```nu
open raw_data.csv
| from csv --trim all                            # Load and clean
| where status != "deleted"                      # Filter out deleted records
| update created_at { |row| $row.created_at | date to-table }  # Parse dates
| each { |row| { ...$row, total: ($row.price * $row.quantity) } }  # Calculate derived field
| sort-by created_at --reverse                   # Sort by date, newest first
| save cleaned_data.csv                          # Write output
```

## Numeric Filtering from String Columns

When numeric values are stored as strings (e.g., ratings, prices), convert before comparing:

```nu
open "data.csv"
| where Rating != ""                              # Filter empty strings first
| each { |r| { ...$r, Rating_num: ($r.Rating | into float) } }
| where Rating_num > 4.0
| select Title Rating_num
```

## Find and Update Multiple Entries

Run separate update commands for each target entry to avoid bash quoting issues with special characters:

```nu
nu -c 'open "data.csv" | update col { |row| if $row.Title == "A" { "Desc A" } else { $row.col } } | collect | save --force "data.csv"'

nu -c 'open "data.csv" | update col { |row| if $row.Title == "B" { "Desc B" } else { $row.col } } | collect | save --force "data.csv"'

nu -c 'open "data.csv" | update col { |row| if $row.Title == "C" { "Desc C" } else { $row.col } } | collect | save --force "data.csv"'
```

## Verify Changes After Update

```nu
# Check a specific entry after in-place update
open "data.csv" | where Title == "EntryName" | get Description | first
```

## Filtering by String Length

```nu
# Find entries with descriptions under 100 chars
open "data.csv"
| each { |row| if ($row.Description | str length) < 100 { $row } else { null } }
| where $it != null
| select Title Description
```

## Combining Tables from Different Sources

### Append Rows (Concatenation)

```nu
# Stack two CSV files with matching column structure
let csv1 = (open data1.csv)
let csv2 = (open data2.csv)
$csv1 | append $csv2

# Using the ++ operator (same as append)
($csv1 ++ $csv2) | save combined.csv
```

### Merge Columns Side-by-Side

```nu
# Merge two tables with different columns
let orders = (open orders.csv)       # columns: order_id, product, amount
let products = (open products.csv)   # columns: product, category, price
$orders | merge $products            # → order_id, product, amount, category, price

# Merge tables of different sizes — wrap smaller table with chunks + flatten
let big = (open large_table.csv)
let small = (open lookup_table.csv)
$big | chunks ($small | length)
| each { merge $small } | flatten
```

## Parsing Non-Standard Text Files

### Colon-Separated Data

```nu
# Parse colon-separated values into a table
open data.txt | lines | split column ":" Name Details
# Or with parse command:
open data.txt | lines | parse "{Name}:{Details}"
```

### Space-Separated Command Output

```nu
# Parse df output into a queryable table
df -h | str replace "Mounted on" Mounted_On | detect columns
| where Use% > "80%"
| select Filesystem Size Used Avail Use% Mounted_On
```

## Custom Commands for Reusable Workflows

### CSV Cleaning Command

```nu
def "clean-csv" [file: path] {
    open $file
    | from csv --trim all
    | where ($in | columns | any { |col| $in | get $col != "" })
    | update date { |row| $row.date | str trim }
}
```

### CSV Validation Command

```nu
def "validate-csv" [file: path, required_columns: list] {
    let data = (open $file)
    let cols = ($data | columns)

    $required_columns | each { |req_col|
        if not ($cols | any { |c| $c == $req_col }) {
            echo $"ERROR: Missing required column: ($req_col)"
        }
    }

    $data | where ($required_columns | any { |col| $in | get $col == "" }) | length
}
```

### Quick CSV Stats Command

```nu
def "csv-stats" [file: path] {
    let data = (open $file)
    {
        rows: ($data | length),
        columns: ($data | columns | length),
        column_names: ($data | columns)
    }
}
```

## Saving Options Reference

| Output Format | Command                            | Notes                                             |
| ------------- | ---------------------------------- | ------------------------------------------------- |
| CSV (default) | `save output.csv`                  | Auto-detected from extension                      |
| TSV           | `save output.tsv --separator "\t"` | Specify tab separator                             |
| JSON          | `to json \| save output.json`      | Add `--pretty` for formatted output               |
| YAML          | `save output.yaml`                 | Auto-detected                                     |
| Append        | `save --append data.csv`           | Append to existing file                           |
| In-place      | `collect \| save --force file.csv` | Required for overwriting the same file being read |
