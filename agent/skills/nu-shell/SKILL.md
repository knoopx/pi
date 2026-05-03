---
name: nu-shell
description: "Reads, filters, transforms, and manipulates structured data using Nushell's pipeline commands. Use when working with CSV/TSV files, parsing command output, transforming tabular data, system administration tasks, or building data pipelines."
---

# nu-shell

Nushell treats all data as structured tables — lists of records with rows and columns. Every file and command output becomes a table you can filter, transform, and combine.

## File I/O & Parsing

Files auto-detect from extension. Pipe command output into tables:

```nu
open data.csv                # CSV → table
df -h | detect columns       # Command output → table
$data | save -f output.csv   # Write (overwrite with -f)
```

## Core Pipeline Commands

### Filtering & Selecting

```nu
open data.csv | where rating > 4.0 and status == "active"
ls | sort-by size | reverse | first 10
```

- `select col1 col2` — keep specific columns (keeps table shape)
- `reject col` — drop a column
- `get col` — extract as a list (not a table)

### Transforming Data

```nu
# Map rows
$items | each { |row| { ...$row, tax: ($row.price * 0.1) } }

# Transform a column
$table | update price { |x| $x * 1.1 }

# Add or update columns
$table | insert new_col ($in.old_col * 2)

# Rename
$table | rename old_name new_name
```

### Combining Data

```nu
$first | append $b          # Stack rows
$first | merge $second      # Side-by-side columns
```

## String Operations

```nu
where name =~ "pattern"         # Regex match
str upcase / str downcase       # Case conversion
str trim / str kebab-case       # Formatting
str join "," $list              # Join list with separator
$"My value is ($expr)"          # Interpolation
```

## Flow Control & Variables

```nu
let x = (open data.csv); mut count = 0
if ($x | length) > 0 { print "has" } else { print "empty" }
for row in $items { process $row }
match $value { "A" => do_a, "B" => do_b, _ => default_action }
try { open nonexistent.txt } catch { |err| print $"Error: ($err.msg)" }

# Capture external command output
do { ^my-command arg1 } | complete   # Returns .exit_code, .stdout, .stderr
```

## Best Practices

- **Prefer internal commands**: Built-ins return structured data. Only use `^` prefix for external binaries when necessary.
- **Collect before save**: Use `collect | save --force file` to avoid read/write conflicts.
- **Type safety**: Empty cells parse as empty strings, not null. Filter empties before numeric conversion: `where column != "" | into int`.
- **Prefer filters over loops**: Use `where`, `each`, `reduce` instead of `for`/`while` — they stream and parallelize better.
