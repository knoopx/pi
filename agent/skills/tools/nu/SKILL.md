---
name: nu
description: "Reads, filters, transforms, and manipulates structured data using Nushell's pipeline commands. Use when working with CSV/TSV files, parsing command output, transforming tabular data, system administration tasks, or building data pipelines."
token_cost: 200
keywords: ["nushell", "nu", "pipeline", "csv", "tsv", "table", "filter"]
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

## JSON Manipulation (jq equivalents)

Nushell replaces `jq` entirely. Parse with `from json`, transform with pipeline commands, output with `to json`.

```nu
# Select a field (jq '.name')
'{"name": "Alice"}' | from json | get name

# Filter array (jq '.[] | select(.age > 28)')
'[...]' | from json | where age > 28

# Map values (jq 'map(. * 2)')
'[1, 2, 3]' | from json | each { $in * 2 }

# Conditional (jq 'if .age > 18 then "Adult" else "Child" end')
'{"age": 30}' | from json | if $in.age > 18 { "Adult" } else { "Child" }

# Format string (jq "Name: \(.name)")
'{"name": "Alice", "age": 30}' | from json | format "Name: {name}, Age: {age}"

# Build new record (jq '{name: .name, age: (.age + 5)}')
'{"name": "Alice", "age": 30}' | from json | {name: $in.name, age: ($in.age + 5)}

# Filter nulls (jq 'map(select(. != null))')
'[1, null, 3]' | from json | where { $in != null }

# Flatten nested arrays (jq '.data[].values[]')
'{"data": [{"values": [1, 2]}]}' | from json | get data.values | flatten

# Sort / unique (jq 'sort' / 'unique')
'[3, 1, 4]' | from json | sort
'[1, 2, 2]' | from json | uniq
```

### Statistical Operations

```nu
# Average (jq 'map(.score) | add / length')
'[...]' | from json | get score | math avg

# Group and aggregate (jq 'group_by(.category)')
'[...]' | from json | group-by --to-table category
| update items { |row| $row.items.value | math sum }
| rename category sum

# Reduce (jq 'reduce .[] as $item (0; . + $item.value)')
'[...]' | from json | reduce -f 0 { |item, acc| $acc + $item.value }
```

### Custom Recursive Commands

For patterns without built-in equivalents, see `references/jq_patterns.md`:

- `cherry-pick` — recursive key extraction (jq `.. | .key?`)
- `walk` — recursive transformation (jq `walk(...)`)
- `flatten record-paths` — flatten nested records to dot-paths

## Best Practices

- **Prefer internal commands**: Built-ins return structured data. Only use `^` prefix for external binaries when necessary.
- **Collect before save**: Use `collect | save --force file` to avoid read/write conflicts.
- **Type safety**: Empty cells parse as empty strings, not null. Filter empties before numeric conversion: `where column != "" | into int`.
- **Prefer filters over loops**: Use `where`, `each`, `reduce` instead of `for`/`while` — they stream and parallelize better.
- **Nushell replaces jq**: For JSON processing, use `from json` + pipeline commands instead of `jq`. Nushell works natively with JSON, YAML, CSV, and more.
- **For heavy JSON analytics**: Use DuckDB (`duckdb` skill) when you need SQL queries, schema inference, or complex joins over JSON data.
