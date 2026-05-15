# Nushell Data Types and Conversions

Nushell models data with simple, structured types. Use `describe` to check the type of any value: `42 | describe` → `int`.

## Basic Data Types

### Integers

Numbers without a fractional component (positive, negative, and 0). Annotation: `int`.

**Literal Syntax:** Decimal (`-100`, `0`, `50`), hex (`0xff`), octal (`0o234`), binary (`0b10101`).

```nu
10 / 2                        # => 5
5 | describe                  # => int
```

### Floats/Decimals

Numbers with a fractional component. Annotation: `float`.

**Literal Syntax:** `1.5`, `2.0`, `-15.333`, `Infinity`.

```nu
2.5 / 5.0                     # => 0.5
# Floats are approximate: 10.2 * 5.1 => 52.01999999999999
```

### Strings

A series of characters representing text. Annotation: `string`.

**Literal Syntax:** Single-quoted (`'text'`), double-quoted (`"text\n"` with escapes), raw (`r#'text'#`), bare word (no quotes), backtick-quoted (`` `text` ``). String interpolation: `$"value ($expr)"` or `$'value ($expr)'`.

```nu
let audience: string = "World"
$"Hello, ($audience)"         # => Hello, World
r#'Can contain '\''quotes'\'''#  # Raw strings
```

### Booleans

True or false value. Annotation: `bool`. Literal syntax: `true` or `false`.

```nu
let mybool: bool = (2 > 1)    # => true
if $mybool { print "yes" }
```

Booleans are commonly the result of comparisons:

```nu
let mybool: bool = ($env.HOME | path exists)   # => true
```

### Dates

Represents a specific point in time. Annotation: `datetime`.

**Literal Syntax:** ISO format strings, or via commands like `date now`.

```nu
date now                      # => Mon, 12 Aug 2024 13:59:22 -0400
date now | format date '%s'   # Unix epoch
"2024-01-01T12:00:00+05:00" | into datetime
```

### Durations

Passage of time, supports fractional values and calculations. Annotation: `duration`.

**Literal Syntax:** `3day`, `2min + 12sec`, `3.14day`.

```nu
30day / 1sec                  # => 2592000 (seconds in 30 days)
3.14day                       # => 3day 3hr 21min
```

### File Sizes

Specialized numeric type for file sizes or number of bytes. Annotation: `filesize`.

**Literal Syntax:** `64mb`, `0.5kB`, `1GiB`.

```nu
1GiB / 1B                     # => 1073741824
(1GiB / 1B) == 2 ** 30        # => true
0.5kB                         # => 500 B
```

### Ranges

Describes a range of values from start to end, with optional stride. Annotation: `range`.

**Literal Syntax:** `<start>..<end>` (`1..10`), with stride `<start>..<second>..<end>` (`2..4..20`).

```nu
1..5                          # Expands to list [1, 2, 3, 4, 5]
```

### Binary Data

Raw bytes. Annotation: `binary`.

**Literal Syntax:** `0x[FE FF]` (hex), `0b[10101010101]` (binary), `0o[1234567]` (octal).

```nu
open nushell_logo.jpg | into binary | first 2 == 0x[ff d8]  # JPEG check
```

### Cell Paths

Expression to navigate inner values in structured data. Annotation: `cell-path`.

**Literal Syntax:** Dot-separated row/column IDs (`name.4.5`). Use leading `$.` for variable assignment.

```nu
let cp = $.2
[ foo bar goo glue ] | get $cp  # => goo
```

### Closures

Anonymous function (lambda) that accepts parameters and closes over variables from outer scope. Annotation: `closure`.

**Literal Syntax:** `{|args| expressions}`.

```nu
let compare_closure = {|a| $a > 5 }
[ 40 -4 0 8 12 ] | where $compare_closure   # => [40, 8, 12]
{ $in.name.0 | path exists }                # Filter closure
```

## Structured Data Types

### Lists

Ordered sequence of zero or more values of any type. Annotation: `list`.

**Literal Syntax:** `[value1 value2 value3]` (space-separated) or `[value1, value2, value3]` (comma-separated). Similar to JSON arrays.

```nu
[Sam Fred George]             # List of strings
[ foo bar goo glue ] | get 2  # => goo
```

### Records

Key-value pairs with string keys. Annotation: `record`.

**Literal Syntax:** `{key1: value1, key2: value2}` or space-separated on multiple lines. Similar to JSON objects.

```nu
let my_record = { name: "Kylian", rank: 99 }
$my_record | get name         # => Kylian
```

### Tables

Two-dimensional container with both columns and rows. Internally, tables are **lists of records**. Annotation: `table`.

```nu
[{x:12, y:5}, {x:3, y:6}] | get 0   # => {x: 12, y: 5} (record, not list item)
# Table literal with explicit columns: [[col1, col2]; [val1, val2], ...]
[[a b]; [1 2]]                      # Creates a table with columns a, b
```

## Other Types

| Type      | Description                                 | Example                                           |
| --------- | ------------------------------------------- | ------------------------------------------------- |
| `any`     | Matches any type (superset for annotations) | `let p: any = 5`                                  |
| `nothing` | Absence of a value                          | `null`, or result of `$rec.field?` on missing key |
| `path`    | File system path — auto-expands `~`, `.`    | Used internally by `path` commands                |
| `glob`    | Glob pattern string                         | `"*.txt"`                                         |
| `block`   | Syntactic form for control flow keywords    | `{ print "hello" }` in `if true { ... }`          |

## Type Conversions (`into`)

Convert between types using the `into` command:

```nu
"42" | into int              # String → integer
"3.14" | into float          # String → float
42 | into string             # Any → string
"2024-01-01" | into datetime # String → datetime
"30s" | into duration        # String → duration
"64MB" | into filesize       # String → filesize
"true" | into bool           # String → boolean
```

## Useful Type Commands

| Command       | Purpose                               | Example  |
| ------------- | ------------------------------------- | -------- | --------------------- |
| `describe`    | Returns the type of a value           | `42      | describe`→`int`       |
| `detect type` | Infers Nushell datatype from a string | `"hello" | detect type`→`string` |
