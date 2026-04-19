---
name: nu-shell
description: "Reads, filters, transforms, and manipulates structured data using Nushell's pipeline commands. Use when working with CSV/TSV files, parsing command output, transforming tabular data, system administration tasks, or building data pipelines."
---

# nu-shell

Nushell treats all data as structured tables (lists of records). Every file format and command output becomes a table with rows and columns. Build pipelines by chaining commands on structured data.

## Cell-Path Navigation

Access values using dot notation: column names (strings) for columns, row indices (integers) for rows.

```nu
$record.field                # Record value at key "field"
$list.0                      # List element at index 0
$table.column                # Column values as a list
$table.row_num               # Row N as a record
$table.column.row_num        # Single cell value
```

See [references/cell-paths.md](references/cell-paths.md) for `get` vs `select`, optional operator (`?`), and nested data.

## File I/O & Parsing

Files auto-detected from extension. Use `--raw` to read without parsing. See [references/parsing.md](references/parsing.md).

```nu
open data.csv                # CSV → table
df -h | detect columns       # Command output → table
$data | to json > out.json   # Write data
$data | save -f output.csv   # Overwrite (-f = --force)
```

## Types & Conversions

`describe` returns the type of any value. See [references/types.md](references/types.md).

```nu
42 | describe                # => int
"hello" | str length         # => 5
0.5kB                        # => filesize
3day + 2min                  # => duration
"42" | into int              # String → integer
```

## Core Pipeline Commands

### Filter, Select & Transform

`where condition`, `first N`, `last N`, `skip N`. See [references/tables.md](references/tables.md).

```nu
open data.csv | where rating > 4.0 and status == "active"
ls | sort-by size | reverse | first 10
```

- **select col1 col2** (keeps table shape), **reject col** (drops columns), **get col** (extracts as list)
- **each**: `each { \|row\| { ...$row, tax: ($row.price * 0.1) } }` — map rows
- **update col**: `update price { \|x\| $x * 1.1 }` — transform column values
- **insert/upsert col expr**: add or update a column
- **rename old new**: rename columns
- Aggregate: `length`, `sum`, `average`, `min`, `max`, `uniq --count`
- Combine: `$a | append $b` (rows), `$first | merge $second` (columns)

### String Operations

See [references/strings.md](references/strings.md). Strings are case-sensitive unless you use `--ignore-case`.

```nu
where name =~ "pattern"         # Regex match
str upcase / str downcase       # Case conversion
str trim / str kebab-case       # Whitespace and formatting
str join "," $list              # Join list with separator
$"My value is ($expr)"          # String interpolation
```

### Flow Control, Variables & Modules

See [references/flow-control.md](references/flow-control.md) for control flow and variables. See [references/custom-commands.md](references/custom-commands.md) for `def` syntax with parameters, flags, rest params, and environment side effects. See [references/modules.md](references/modules.md) for module organization and overlays.

See [references/operators.md](references/operators.md) for arithmetic, comparison, regex, bitwise, spread, and assignment operators.

See [references/environment.md](references/environment.md) for `$env` scoping rules, `with-env`, and the `$nu` constant.

```nu
let x = (open data.csv); mut count = 0
if ($x | length) > 0 { print "has" } else { print "empty" }
for row in $items { process $row }
match $value { "A" => do_a, "B" => do_b, _ => default_action }
try { open nonexistent.txt } catch { |err| print $"Error: ($err.msg)" }
ls | where type == file | sort-by size | reverse   # ls returns a table
ps | where cpu > 0 | sort-by cpu | reverse         # Process management
$env.PATH ++= ["~/.local/bin"]                     # Append to PATH list
do { ^my-command arg1 } | complete                 # Capture: .exit_code, .stdout, .stderr
```

## Scripts

Write `.nu` files with shebangs for standalone execution. See [references/scripts.md](references/scripts.md) for writing scripts, argument handling, `source` vs execute, and common patterns.

```nu
#!/usr/bin/env nu
# script.nu — Example script
let file = ($env.CURRENT_FILE | path dirname)
print $"Script dir: ($file)"
```

## Best Practices

- **Prefer internal commands**: Built-in commands return structured data. Only use `^` prefix for external binaries when necessary.
- **Collect before save**: When modifying in place, use `collect | save --force file` to avoid read/write conflicts.
- **Type safety**: Empty cells parse as empty strings, not null. Filter empties before numeric conversion: `where column != "" | into int`.
- **Use `get` for extraction, `select` for shaping**: `get name` returns a list; `select name` returns a table with that column.
- **Prefer filters over loops**: Use `where`, `each`, `reduce` instead of `for`/`while` — they stream and parallelize better.
