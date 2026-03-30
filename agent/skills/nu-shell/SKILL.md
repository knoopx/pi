---
name: nu-shell
description: "Processes structured data through pipelines, filters tables, transforms JSON/CSV/YAML, and defines custom commands. Use when scripting with typed parameters or working with tabular data."
---

# nu-shell

Structured data scripting through pipelines with tables, lists, and records.

## Quick Start

```bash
nu myscript.nu           # Run script file
nu -c 'ls | length'      # Run inline command
source myscript.nu       # Run in current session
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

## Data Operations

### Loading and Saving

```nu
let config = (open config.json)      # Auto-detects format
let data = (open data.csv)
$data | save output.yaml             # Converts automatically
$data | to json | save output.json   # Explicit conversion
```

### Filtering, Selecting, and Transforming

```nu
ls | where size > 10mb | sort-by size     # Filter and sort
ls | select name size                      # Select columns
(open package.json).version                # Access nested fields
ls | group-by type | get dir | length      # Group and aggregate

# Records
let user = { name: "John", age: 30 }
let updated = { ...$user, age: 31 }       # Spread to update

# Lists
[1, 2, 3] | each { |x| $x * 2 }                        # Map
[1, 2, 3, 4, 5] | where $it > 2                         # Filter
[1, 2, 3, 4, 5] | reduce { |acc, x| $acc + $x }        # Reduce
```

## Custom Commands

```nu
#!/usr/bin/env nu

# Typed parameters with defaults
def "create project" [name: string, type: string = "typescript"] {
    echo $"Creating ($name) with ($type)"
}

# Flags
def "deploy" [--env: string = "production", --dry-run] {
    if $dry_run { echo $"Would deploy to ($env)" } else { echo $"Deploying to ($env)" }
}
```

## Control Flow

```nu
if $condition { "yes" } else { "no" }
for i in 1..10 { echo $i }

mut counter = 0
while $counter < 5 {
    $counter = $counter + 1
}
```

## File Operations

```nu
let content = (open "file.txt")       # Read
$content | save "output.txt"          # Write (overwrites)
$content | save --append "log.txt"    # Append
```

## Constraints

- String interpolation uses `$"text ($var)"` — parentheses required around expressions
- Pipelines are the primary control flow — prefer `| where` over `if` loops for filtering
- `mut` is required for mutable variables — all `let` bindings are immutable by default
- `$it` is the implicit row variable in closures — use named params `{ |x| ... }` for clarity
