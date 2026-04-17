---
name: nu-shell
description: "Reads, filters, transforms, and manipulates CSV/TSV files using Nushell's structured data pipeline. Use when working with tabular data, data cleaning, CSV validation, or batch processing spreadsheet-like files."
---

# nu-shell-tabular-data

Read, filter, transform, and manipulate CSV/TSV files using Nushell's structured data pipeline.

## Quick Start

```bash
nu -c 'open data.csv | where rating > 4.0'     # Filter CSV
nu -c 'open data.tsv -s "\t" | get column1'    # Read TSV with tab separator
open file.csv | save output.json               # Convert format
```

## Core Data Types

- **Record**: `{ name: "John", age: 30 }` — key-value pairs, access with `$record.field`
- **List**: `[1, 2, 3]` — ordered collection, process with `each`, `where`, `reduce`
- **Table**: List of records with the same keys — the primary data structure for pipelines

## End-to-End Pipeline Example

Load a CSV, filter, transform, validate, and save:

```nu
# Load → filter → transform → validate → save
let orders = (open orders.csv)
let large_orders = ($orders
    | where amount > 100
    | each { |row| { ...$row, tax: ($row.amount * 0.1) } }
    | sort-by amount --reverse)

# Validate: confirm no empty customer fields
let invalid = ($large_orders | where customer == "")
if ($invalid | length) > 0 {
    echo $"WARNING: ($invalid | length) orders missing customer"
}

$large_orders | save large_orders.json
```

## Opening and Parsing Files

### `open` (Auto-detects format from extension)

```nu
open data.csv           # CSV file
open data.tsv           # TSV file (tab-separated)
open data.xlsx          # Excel file

# Flags
open data.csv --raw     # Raw text, not parsed
open data.csv --trim    # Trim whitespace from headers and values
```

### `from csv` (Custom parsing options)

```nu
# Parse CSV string with custom options
"col1,col2
1,2" | from csv

# Custom separator (for TSV or other delimiters)
open data.txt | from csv --separator "\t"    # Tab-separated
open data.txt | from csv --separator ";"     # Semicolon-separated

# Handle variable columns
open data.csv | from csv --flexible          # Allow different column counts

# Skip header row
open data.csv | from csv --noheaders         # First row is data, not headers

# Ignore comments
open data.csv | from csv --comment "#"       # Skip lines starting with #

# Trim whitespace
open data.csv | from csv --trim all          # Trim headers and values
open data.csv | from csv --trim headers      # Trim only headers
open data.csv | from csv --trim fields       # Trim only values
```

## Filtering, Selecting, and Sorting

```nu
# Filter rows by condition
open data.csv | where rating > 4.0
open data.csv | where status == "active"
open data.csv | where price > 100 and category == "electronics"

# Select specific columns
open data.csv | select name price category
open data.csv | select -exclude internal_id notes

# Sort data
open data.csv | sort-by price --reverse
open data.csv | sort-by category name      # Multi-column sort

# Limit results
open data.csv | first 10                   # First 10 rows
open data.csv | last 5                     # Last 5 rows
open data.csv | skip 10 | first 20         # Rows 11-30
```

## Transforming Data

```nu
# Add new column
open data.csv | each { |row| { ...$row, tax: ($row.price * 0.1) } }

# Rename columns
open data.csv | rename name price category | rename name customer_name

# Update column values
open data.csv | update price { |row| $row.price * 1.09 }  # Add 9%

# Merge columns
open data.csv | each { |row| { ...$row, full_name: ($row.first_name + " " + $row.last_name) } }

# Insert column at position
open data.csv | insert tax 0               # Insert at beginning
```

## Aggregation and Statistics

```nu
# Count rows
open data.csv | length

# Sum values
open data.csv | get price | sum

# Average
open data.csv | get price | average

# Min/Max
open data.csv | get price | min
open data.csv | get price | max

# Unique values with counts
open data.csv | get category | uniq --count
# Returns table with 'value' and 'count' columns

# Find duplicates
open data.csv | get Title | uniq --count | where count > 1
# Shows: Sala Apolo (2), El Patio (2)
```

## Column Operations

```nu
# Rename columns
open data.csv | rename old_name new_name

# Reorder columns
open data.csv | select category price name  # Specify order

# Delete columns
open data.csv | drop internal_id notes

# Insert new column
open data.csv | insert calculated_field { |row| $row.price * $row.quantity }

# Move column
open data.csv | move name --after category
```

## Save Options

```nu
# Save as CSV (default)
open data.json | save output.csv

# Save as TSV
open data.csv | save output.tsv --separator "\t"

# Save as other formats
open data.csv | to json | save output.json
open data.csv | save output.yaml

# Append to file
open new_data.csv | save --append existing.csv

# With pretty print
open data.csv | to json --pretty | save output.json
```

## Edge Cases

```nu
# Files without headers
open data.csv | from csv --noheaders | rename col1 col2 col3

# Inconsistent column counts
open data.csv | from csv --flexible

# Quoted fields with commas
open data.csv | from csv --quote '"'  # Default, handles "field,with,commas"

# Escape characters
open data.csv | from csv --escape "\\"

# Different line endings
open data.csv | lines | from csv --noheaders  # Handle manually if needed
```

## Custom Commands for CSV Work

```nu
# Create reusable CSV cleaning command
def "clean-csv" [file: path] {
    open $file
    | from csv --trim all
    | where ($in | columns | any { |col| $in | get $col != "" })
    | update date { |row| $row.date | str trim }
}

# CSV validation command
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

# Quick CSV stats
def "csv-stats" [file: path] {
    let data = (open $file)
    {
        rows: ($data | length)
        columns: ($data | columns | length)
        column_names: ($data | columns)
    }
}
```

## Common Patterns

### Extract Specific Data

```nu
# Get all unique categories with counts
open products.csv | get category | uniq --count | sort-by count --reverse

# Find top 10 by value
open sales.csv | sort-by amount --reverse | first 10 | select name amount

# Filter by multiple conditions
open users.csv | where status == "active" | where last_login > "2024-01-01"
```

### Data Transformation Pipeline

```nu
# Complete ETL pipeline
open raw_data.csv
| from csv --trim all                          # Load and clean
| where status != "deleted"                    # Filter
| update created_at { |row| $row.created_at | date to-table }  # Transform dates
| each { |row| { ...$row, total: ($row.price * $row.quantity) } }  # Calculate
| sort-by created_at --reverse                 # Sort
| save cleaned_data.csv                        # Output
```

## Constraints

- Column names with spaces require quotes: `open data.csv | get "column name"`
- Use `--flexible` for CSVs with inconsistent column counts
- `from csv` is needed for custom separators; `open` auto-detects for `.csv` files
- Empty cells are represented as empty string — filter with `where column != ""` before numeric conversion
- Convert string numbers to floats: `$value | into float` (filter empty strings first)
- Date parsing: `$row.date | into datetime`
- Use `into int` for integers, `into float` for decimals, `into datetime` for dates
- Multi-condition `where` clauses need parentheses: `($row.Title == "X" and ($row.Address | str contains "Y"))`
- `uniq --count` returns table with `value` and `count` columns, not grouped records
- **In-place file updates require `collect | save --force`** to avoid read/write conflicts
- **Use `$row.column` not `$in.column` inside update blocks**
- **Update one entry at a time** to avoid bash quoting issues with special characters
- **Single `if/else` works in `update` blocks; avoid `else if` chains in `-c` commands**

## Real-World Usage Patterns

### Conditional Updates by Title

```nu
# Update specific rows based on title match (one at a time to avoid bash quoting issues)
open "Favorite Places.csv"
| update Description { |row|
    if $row.Title == "Parc Sant Salvador" {
        "New description here"
    } else {
        $row.Description  # Keep original
    }
}
| collect | save --force "Favorite Places.csv"

# For multiple entries, run separate update commands:
# nu -c 'open "data.csv" | update col { |row| if $row.Title == "A" { "Desc A" } else { $row.col } } | collect | save --force "data.csv"'
# nu -c 'open "data.csv" | update col { |row| if $row.Title == "B" { "Desc B" } else { $row.col } } | collect | save --force "data.csv"'
```

### Multi-Condition Updates

```nu
# Handle duplicate titles with additional condition (use parentheses for complex conditions)
open "Favorite Places.csv"
| update Description { |row|
    if ($row.Title == "El Patio" and ($row.Address | str contains "Sevilla")) {
        "Specific description for this location"
    } else {
        $row.Description
    }
}
| collect | save --force "Favorite Places.csv"
```

### Numeric Filtering with String Columns

```nu
# Convert string ratings to floats for comparison
open "Favorite Places.csv"
| where Rating != ""
| each { |r| { ...$r, Rating_num: ($r.Rating | into float) } }
| where Rating_num > 4.0
| select Title Rating_num
```

### Find and Update Multiple Entries

```nu
# Update entries one at a time to avoid bash quoting issues
# Run separate commands for each entry:

nu -c 'open "data.csv" | update col { |row| if $row.Title == "A" { "Desc A" } else { $row.col } } | collect | save --force "data.csv"'

nu -c 'open "data.csv" | update col { |row| if $row.Title == "B" { "Desc B" } else { $row.col } } | collect | save --force "data.csv"'

nu -c 'open "data.csv" | update col { |row| if $row.Title == "C" { "Desc C" } else { $row.col } } | collect | save --force "data.csv"'
```

### Verify Changes

```nu
# Check a specific entry after update
open "data.csv" | where Title == "EntryName" | get Description | first
```

### Filter Short Descriptions

```nu
# Find entries with descriptions under 100 chars
open "Favorite Places.csv"
| each { |row| if ($row.Description | str length) < 100 { $row } else { null } }
| where $it != null
| select Title Description
```

### Exclude Pattern Matches

```nu
# Filter out entries matching pattern
open "Favorite Places.csv"
| where Title !~ "FPV"  # Exclude FPV sites
| each { |row| if ($row.Description | str length) < 150 { $row } else { null } }
| where $it != null
```

### String Operations in Conditions

```nu
# Use str contains for partial matches (requires each/where pattern)
open "data.csv"
| each { |row| if ($row.Address | str contains "Barcelona") { $row } else { null } }
| where $it != null
| each { |row| if ($row.Description | str contains "restaurant") { $row } else { null } }
| where $it != null
```

### Save with Same Filename

```nu
# Overwrite original file (requires collect to avoid read/write conflict)
open "data.csv"
| update column { ... }
| collect | save --force "data.csv"

# Or save as new file
open "data.csv"
| update column { ... }
| save "data_enriched.csv"
```
