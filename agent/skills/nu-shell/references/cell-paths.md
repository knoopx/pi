# Cell-Path Syntax and Structured Data Navigation

Cell-paths are the primary way to access values inside structured data. The path is based on a concept similar to spreadsheets: columns have names (strings), rows have numbers (integers). Members are separated by dots.

## Records

For a record, the cell-path specifies the name of a key (a string).

```nu
let my_record = { a: 5, b: 42 }
$my_record.b + 5                    # => 47

# Access with get command (supports variables and expressions)
$my_record | get b
$my_record | get $"dynamic_key"     # Quoted for dynamic keys
```

## Lists

For a list, the cell-path specifies the position (index) of the value. Indices are 0-based.

```nu
let scoobies_list = [ Velma Fred Daphne Shaggy Scooby ]
$scoobies_list.2                    # => Daphne

$my_list | get 0                    # First element
$my_list | get -1                   # Last element
```

## Tables

A table is a list of records. Access patterns:

| Pattern          | What it returns             | Example                                                     |
| ---------------- | --------------------------- | ----------------------------------------------------------- |
| `table.column`   | Column values as a **list** | `$data.temps` → `[38.24, 35.24, ...]`                       |
| `table.N`        | Row N as a **record**       | `$data.1` → `{date: ..., temps: [...], condition: "sunny"}` |
| `table.column.N` | Single cell **value**       | `$data.condition.3` → `"rain"`                              |

### Sample Data for Examples

```nu
let data = [
    [date                        temps                                   condition      ];
    [2022-02-01T14:30:00+05:00,  [38.24, 38.50, 37.99, 37.98, 39.10],   'sunny'       ],
    [2022-02-02T14:30:00+05:00,  [35.24, 35.94, 34.91, 35.24, 36.65],   'sunny'       ],
    [2022-02-03T14:30:00+05:00,  [35.17, 36.67, 34.42, 35.76, 36.52],   'cloudy'      ],
    [2022-02-04T14:30:00+05:00,  [39.24, 40.94, 39.21, 38.99, 38.80],   'rain'        ]
]
```

### Accessing a Table Row (Record)

```nu
$data.1
# => {date: "2 years ago", temps: [35.24, 35.94, ...], condition: "sunny"}
```

### Accessing a Table Column (List)

```nu
$data.condition
# => ["sunny", "sunny", "cloudy", "rain"]
```

### Accessing a Single Cell (Value)

```nu
$data.condition.3                   # => rain
$data.temps.2.1                    # => 36.67 (row 2, temps column, index 1)
```

## Nested Data

Cell-paths can reference multiple levels of nesting. Lists within tables contain nested data:

```nu
# $data.temps.2.1 — first index (2) accesses the third day's temps list,
# second index (1) accesses station 1
$data.temps.2.1                     # => 36.67
```

## Using `get` vs `select`

| Command  | Behavior                                                                             | Result type              |
| -------- | ------------------------------------------------------------------------------------ | ------------------------ |
| `get`    | Returns the **value** indicated by the cell-path                                     | List or scalar           |
| `select` | Returns a new **data structure** (table/list/record) with the specified rows/columns | Same shape, reduced size |

### Example: `get` vs `select` a Table Row

```nu
$data | get 1
# => {date: "2 years ago", temps: [35.24, ...], condition: "sunny"}   (record)

$data | select 1
# => # │ date       │ temps        │ condition    │     (single-row table with indices)
```

### Example: `select` with Multiple Rows and Columns

```nu
# Select specific columns AND rows at once
$data | select date condition 0 1
# => # │ date        │ condition │
# => 0 │ 2 years ago │ sunny     │
# => 1 │ 2 years ago │ sunny     │
```

### Row Indices After `select`

The new table has its own 0-based index, different from the original. Use `enumerate` to preserve original indices:

```nu
$data | enumerate | select 1    # Original index preserved as "index" column
```

## Optional Operator (`?`)

By default, cell-path access fails if it cannot access the requested row or column. Add `?` to suppress errors — missing cells are replaced by `null`:

```nu
let cp = $.temps?.1              # Cell-path variable with optional member
$data | reject temps | get $cp   # Returns null instead of error

# Inline optional access
$simple_record.field?            # null if missing, no error thrown
$simple_record.c? | describe     # => nothing
$simple_record.c? == null        # => true
```

## Missing Data with `default`

The `default` command applies a default value to missing or null column values:

```nu
let missing_value = [{a:1 b:2} {b:1}]
$missing_value | default 'n/a' a
# => # │ a   │ b │
# => 0 │ 1   │ 2 │
# => 1 │ n/a │ 1 │

$missing_value.1.a              # => n/a
```

## Column Names with Spaces or Special Characters

When a column name contains spaces or cannot be a bare-word string, quote it:

```nu
let record_example = { "key x": 12, "key y": 4 }
$record_example."key x"          # => 12
$record_example | get "key x"   # => 12

# Also needed when key name may be confused for a numeric value
let record_example = { "1": foo, "2": baz }
$record_example."1"              # => foo (string key, not index 1)
```

## Special Variables and Cell-Path Assignment

Assign cell-paths to variables using `$.` prefix:

```nu
let cp = $.2                     # List index 2
[ foo bar goo glue ] | get $cp   # => goo

# Use in closures
{ $in.name.0 | path exists }     # First character of name column
```
