# Sorting Data

Nushell supports sorting tables by any column that can be compared (numbers, strings, dates, file sizes).

## Basic Sorting

```nu
open data.csv | sort-by price          # Ascending
open data.csv | sort-by price --reverse # Descending
```

## Multi-Column Sort

Sort by multiple columns. The order of arguments determines priority:

```nu
# Sort by category first, then by name within each category
open data.csv | sort-by category name

# With direction per column (all must use same direction)
open data.csv | sort-by category --reverse name  # category desc, name asc
```

## Sorting by Calculated Values

Sort using a closure to compute values on the fly:

```nu
# Sort by computed field
open data.csv | sort-by { $in.price * $in.quantity } --reverse

# Sort by string length
open data.csv | sort-by { ($in.name | str length) }
```

## Sorting with Index Preservation

When sorting, the internal `#` index changes. To preserve original row positions, convert to a real index column first:

```nu
# Standard pattern: enumerate → flatten → sort → select
open data.csv | enumerate | flatten | sort-by modified | first 5
```

The `enumerate | flatten` pattern converts the internal `#` into an `index` column that sorts independently from other columns.

## Sorting by Date

```nu
open data.csv | sort-by date           # Ascending (oldest first)
open data.csv | sort-by date --reverse # Descending (newest first)
```

## Important Notes

- **Column names with spaces**: quote them — `sort-by "column name"`
- **Numeric columns stored as strings**: convert first with `into float` before sorting
- **Reverse applies to all sort keys**: `--reverse` affects the entire sort, not individual columns
- **Null values**: sort to the end of the result
