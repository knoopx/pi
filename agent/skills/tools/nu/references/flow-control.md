# Flow Control and Variables

Nushell includes flow control statements and expressions similar to other languages. Prefer filters over flow control for structured data operations — use `where`, `each`, `reduce` instead of loops when possible.

## Variables

### Immutable Variables (`let`)

```nu
let x = 42
let name: string = "Nushell"
let items = (open data.csv)                    # Subexpression in parens
let count = ($items | length)                  # Pipeline result
```

Variables are immutable. They cannot be reassigned.

### Mutable Variables (`mut`)

```nu
mut counter = 0
$counter += 1                                   # Increment
$counter -= 5                                   # Decrement
$counter *= 2                                   # Multiply
let total: int = ($items | math sum)            # Let with type annotation and computation
```

### Parse-Time Constants (`const`)

Defined at parse time (before execution), useful for module-level constants:

```nu
const MAX_RETRIES = 3
const API_URL = "https://api.example.com"
```

## String Interpolation

Use `$"..."` or `$'...'` with expressions in parentheses. Double quotes interpret escape sequences; single quotes do not.

```nu
let name = "Nushell"
$"My favorite shell is ($name)"

# Executing external commands via interpolation (use ^ prefix)
let path1 = "/part1"
let path2 = "/part2"
^$"($path1)($path2)/file.txt"

# Recognized escape sequences in double-quoted strings
"\e[31mRed\e[0m"     # Escape character + ANSI codes
"\n\t\r\b"           # Newline, tab, carriage return, backspace
```

## Flow Control Statements

### `if` / `else` — Conditional Expression

`if` is an expression (returns a value), not just a statement:

```nu
# Basic if/else
if true { print "yes" } else { print "no" }

# Assignment from conditional
let result = if $x > 0 { "positive" } else { "non-positive" }

# Elif chain (optional else)
if condition1 { ... } elif condition2 { ... } else { ... }

# The else branch is an expression — allows chained ifs naturally
if false { 1 } else 100         # => 100
```

### `for` — Iterate Over a Range or List

```nu
for i in 1..5 { print $i }      # Iterate range: 1, 2, 3, 4, 5
for item in $items { process $item }    # Iterate list/table values
```

### `while` — Conditional Loop

```nu
mut n = 0
while ($n < 5) {
    print $n
    $n += 1
}
```

### `loop` — Infinite Loop with Break/Continue

```nu
loop {
    let input = (input)
    if $input == "quit" { break }
    print $"You said: ($input)"
}
```

### `match` — Pattern Matching

```nu
match $value {
    "A" => { print "A" }
    "B" | "C" => { print "B or C" }
    1..10 => { print "range 1-10" }
    _ => { print "default / other" }
}

# Match on record fields
match $record {
    { name: "admin", role: "superuser" } => { grant_full_access }
    { name: $n, role: "user" } => { grant_basic_access $n }
    _ => { deny }
}
```

### `try` / `catch` — Error Handling

```nu
# Try a block; catch errors
try { open nonexistent.txt } catch { |err| print $"Error: ($err.msg)" }

# Catch specific error types by matching on error record
try { int "not-a-number" } catch { |e|
    match $e {
        { msg: $msg } => print $"Type error: ($msg)"
        _ => print "Unknown error"
    }
}

# Nested try/catch in closures
open data.csv | each { |row|
    try { $row.price | into float } catch { 0.0 }
}
```

### `break` / `continue` / `return` — Loop Control

```nu
for i in 1..10 {
    if $i == 3 { continue }        # Skip to next iteration
    if $i == 7 { break }           # Exit loop entirely
    print $i                       # Prints: 1, 2, 4, 5, 6
}

# return — early exit from custom command
def my-cmd [] {
    if ($input | is-empty) { return null }
    $input | where active == true
}
```

## Operators

### Arithmetic

`+`, `-`, `*`, `/`, `//` (floor division), `mod`, `**` (power)

### Comparison

`==`, `!=`, `<`, `>`, `<=`, `>=`

### Pattern Matching

| Operator                    | Description          | Example                 |
| --------------------------- | -------------------- | ----------------------- |
| `=~` / `like`               | Regex match          | `$name =~ "^A"`         |
| `!~` / `not-like`           | Not regex match      | `$name !~ "pattern"`    |
| `in`                        | Member of (no regex) | `"a" in ["a", "b"]`     |
| `not-in`                    | Not member of        | `"c" not-in ["a", "b"]` |
| `has`                       | Contains value       | `$list has 5`           |
| `starts-with` / `ends-with` | Prefix/suffix check  | `$name starts-with "A"` |
| `and` / `or`                | Logical operators    | `$x > 0 and $y < 10`    |

### Bitwise (Nushell-specific names)

`bit-and`, `bit-or`, `bit-xor`, `bit-shl`, `bit-shr`

## Pipes and Redirection

Nushell has rich stream handling for external commands:

| Syntax      | Description                                |
| ----------- | ------------------------------------------ |
| `\|`        | Standard stdout pipe (internal only)       |
| `e>\|`      | Pipe stderr from external command          |
| `o+e>\|`    | Pipe stdout + stderr from external command |
| `o> file`   | Redirect stdout to file                    |
| `e> file`   | Redirect stderr to file                    |
| `o+e> file` | Redirect both to file                      |

```nu
# Capture structured output from external commands
let result = do { ^my-command arg1 } | complete
$result.exit_code    # Exit status
$result.stdout       # Parsed nu value
$result.stderr       # Error message

# Pipe specific streams
^command e>| str upcase          # stderr → next command
^command o+e>| str upcase        # stdout + stderr → next command
```

## Custom Commands (`def`)

```nu
# Basic definition with positional and named parameters
def process-data [
    input: record,               # Required positional parameter with type hint
    --verbose                    # Optional flag (boolean)
] {
    $input | where status == "active"
}

# Using closure for row processing
open data.csv | each { |row|
    if ($row.price > 100) { $row } else { null }
} | where $it != null

# Exporting from modules (see references/modules.md)
```

## Special Variables

| Variable | Description                                                        | Example                                         |
| -------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `$in`    | Current pipeline input                                             | Used implicitly by most commands                |
| `$env`   | Environment variables                                              | `$env.PATH`, `$env.HOME`                        |
| `$nu`    | Nushell metadata (version, config path, env-path)                  | `$nu.env-path`                                  |
| `$it`    | Iteration variable in closures (legacy: use `$in` or named params) | Deprecated in favor of named closure parameters |
