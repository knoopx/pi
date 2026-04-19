# Working with Tables

Nushell tables are lists of records with consistent keys. All data modifications produce new values (functional, not in-place).

## Sorting

```nu
ls | sort-by size                  # Ascending by column
ls | sort-by size --reverse         # Descending
ls | sort-by category name          # Multi-column sort (category first, then name)
```

See [sorting.md](sorting.md) for full sorting details.

## Selecting and Filtering Rows

```nu
# Position-based selection
open data.csv | first 10            # Top N rows
open data.csv | last 5              # Bottom N rows
open data.csv | skip 10 | first 20  # Skip N, take M (rows N+1 to N+M)

# Row index access via select
ls | sort-by name | select 5        # Single row by index (keeps table shape)

# Condition-based filtering (where command)
open data.csv | where rating > 4.0
open data.csv | where status == "active" and category == "electronics"
open data.csv | where price !~ "FPV"  # Regex exclude pattern
```

## Selecting Columns

```nu
# Keep specific columns (table shape preserved)
open data.csv | select name price category

# Drop specific columns (reject is the opposite of select)
open data.csv | reject internal_id notes

# Exclude mode (select with --exclude flag)
open data.csv | select -exclude internal_id notes
```

## The `#` Index Column

Every table displays a `#` index column by default. It has two modes:

### Internal `#` (Default)

- 0-based, consecutive index
- Always corresponds to the cell-path row-number (`select 0` returns first item)
- Not accessible by column name — `get index` or `get #` will not work
- Cannot be sorted independently from other columns

### "Index"-Renamed `#`

When a column named `index` is created (directly or via `enumerate | flatten`), it takes the place of the internal `#`:

```nu
# Convert internal # to a real index column that survives sorting
ls | enumerate | flatten | sort-by modified | first 5
# => The index values are now decoupled from cell-paths and sort with other columns

# Create custom index values
ls | each { insert index { 1000 }} | first 5
# => #  │ name        │ type  │ size    │ modified
# => 1000│ CNAME       │ file  │ 15 B    │ 9 months ago

# Rows without an index key break table structure → results in list<any>
ls | upsert 3.index { "--->" } | describe
# => list<any> (stream)
```

## The `table` Command

Renders structured data to a string. Useful for stripping ANSI codes or customizing display:

```nu
# Strip ANSI colors from table output
ls | table | ansi strip

# Expand collapsed data, hide index, abbreviate rows
scope modules | table -e              # Expand all nested data
scope modules | table -i false        # Hide the # column
scope modules | table -a 5            # Show first and last 5 entries only
```

## Concatenating Tables (Append Rows)

Use `append` or the `++` operator to stack tables vertically:

```nu
let first = [[a b]; [1 2]]
let second = [[a b]; [3 4]]
$first | append $second
# => # │ a │ b │
# => 0 │ 1 │ 2 │
# => 1 │ 3 │ 4 │

# Same with operator
$first ++ $second

# Different column sets — columns merge, missing values are empty
let third = [[a c]; [3 4]]
$first | append $second | append $third
# => # │ a │ b  │ c
# => 0 │ 1 │ 2  │ ❎
# => 1 │ 3 │ 4  │ ❎
# => 2 │ 3 │ ❎ │ 4
```

## Merging Tables (Combine Columns)

Use `merge` to join tables side-by-side by combining their columns:

```nu
# Basic merge — same row count
let t1 = [[a b]; [1 2]]
let t2 = [[c d]; [3 4]]
$t1 | merge $t2
# => # │ a │ b │ c │ d │
# => 0 │ 1 │ 2 │ 3 │ 4 │

# Chain merges for more tables
let t3 = [[e f]; [5 6]]
$t1 | merge $t2 | merge $t3
# => # │ a │ b │ c │ d │ e │ f │

# Dynamic merge of multiple tables using reduce
[$t1 $t2 $t3] | reduce { |elt, acc| $acc | merge $elt }
```

## Merging Tables of Different Sizes

When the smaller table has fewer rows than the larger one, `merge` leaves empty cells. Use `chunks + each + flatten` to wrap the smaller table:

```nu
let big = [[a b]; [1 2] [3 4]]      # 2 rows
let small = [[c d]; [5 6]]          # 1 row

# Without chunks — missing values in extra rows
$big | merge $small
# => # │ a │ b │ c │ d │
# => 0 │ 1 │ 2 │ 5 │ 6 │
# => 1 │ 3 │ 4 │ ❎ │ ❎ │

# With chunks — wrap smaller table across all rows of larger one
$big | chunks ($small | length)
| each { merge $small } | flatten
# => # │ a │ b │ c │ d │
# => 0 │ 1 │ 2 │ 5 │ 6 │
# => 1 │ 3 │ 4 │ 5 │ 6 │

# Three tables: chain the pattern
$big
| chunks ($small | length)
| each { merge $small } | flatten
| chunks ([$third] | length)
| each { merge $third } | flatten
```

## Adding and Modifying Columns

### `insert` — Add a New Column at Beginning

```nu
open rustfmt.toml | insert next_edition 2021
# => edition    │ 2018
# => next_edition │ 2021     ← new column at beginning

# Insert with computed values using closure
open data.csv | insert calculated_field { |row| $row.price * $row.quantity }
```

### `update` — Change Column Values (Column Must Exist)

```nu
# Per-row transform with closure
open data.csv | update price { |row| $row.price * 1.09 }

# Direct value reference (shorter syntax)
open data.csv | update price { |x| $x * 1.09 }

# Conditional update using if/else in closure
open "data.csv"
| update Description { |row|
    if $row.Title == "Parc Sant Salvador" {
        "New description here"
    } else {
        $row.Description
    }
}

# ⚠️ Multi-condition where clauses need parentheses:
open "data.csv"
| update Description { |row|
    if ($row.Title == "El Patio" and ($row.Address | str contains "Sevilla")) {
        "Specific description"
    } else {
        $row.Description
    }
}
```

### `upsert` — Update or Insert (Column May Not Exist)

Creates the column if it does not exist; updates values if it does.

```nu
open data.csv | upsert status "pending"     # Creates if missing, overwrites if present
```

### Moving Columns

```nu
ls | move name --after size                 # Move after a specific column
ls | move name --first                      # Move to beginning
ls | move name --last                       # Move to end
```

### Renaming Columns

```nu
open data.csv | rename old_name new_name           # One pair
open data.csv | rename f1 f2 f3 f4                 # Multiple pairs (one-to-one mapping)
open data.csv | rename name customer_name           # Rename a single column
```

### Deleting Columns

```nu
open data.csv | reject internal_id notes    # Drop columns by name
```

## Column Operations Reference

| Command                       | Purpose                     | Example                       |
| ----------------------------- | --------------------------- | ----------------------------- | --- | -------------------- |
| `select cols...`              | Keep specified columns      | `select name price category`  |
| `reject cols...`              | Drop specified columns      | `reject id _hidden`           |
| `rename old new...`           | Rename columns (pairs)      | `rename x lat y lon`          |
| `insert col value`            | Add column at beginning     | `insert tax 0`                |
| `insert col {closure}`        | Add with computed values    | `insert total {               | r   | $r.price \* $r.qty}` |
| `update col {closure}`        | Transform existing column   | `update price {               | r   | $r.price \* 1.1}`    |
| `upsert col value`            | Insert or update column     | `upsert status "active"`      |
| `move col --after/first/last` | Reorder columns by position | `move name --after category`  |
| `default val col`             | Fill nulls with default     | `default 'N/A' missing_field` |

## Aggregation and Statistics

```nu
open data.csv | length                # Count rows
open data.csv | get price | sum       # Sum values in column
open data.csv | get price | average   # Average (mean)
open data.csv | get price | min       # Minimum value
open data.csv | get price | max       # Maximum value
open data.csv | get category | uniq --count  # Unique values with counts → table {value, count}

# Find duplicates
open data.csv | get Title | uniq --count | where count > 1
```

## `enumerate` / `flatten` — Row Indexing Pattern

Convert the internal `#` index into a real `index` column that sorts independently:

```nu
# Standard pattern: enumerate adds {item, index} pair to each row
# flatten extracts those into top-level columns
open data.csv | enumerate | flatten | sort-by modified | first 5
```

## `collect` — Buffer a Stream

Converts a streaming table into an in-memory value. Required before `save --force` for in-place updates:

```nu
# In-place file update (avoid read/write conflict)
open "data.csv"
| update column { ... }
| collect | save --force "data.csv"
```

## Combining Tables from External Sources

Parse command output into tables and combine with CSV data:

```nu
# Merge CSV data with filesystem info
let csv_data = (open data.csv)
let file_info = (ls | select name size type modified)
$csv_data | append $file_info              # Append rows if columns align

# Parse disk usage table and merge
df -h | str replace "Mounted on" Mounted_On | detect columns
| where Use% > "80%"                       # Filter high-usage disks
```

## `compact` — Remove Rows with All-Empty Fields

```nu
open data.csv | compact    # Remove rows where every cell is empty/null
```
