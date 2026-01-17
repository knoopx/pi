name: nu-shell
description: Perform advanced shell scripting, data processing, and automation using nu-shell's structured data handling. Use when processing structured data through pipelines, writing scripts with parameters, manipulating tables/lists, or automating tasks.
---

# nu-shell Skill

This skill provides patterns and documentation for scripting with `nu-shell`. nu-shell is unique because it passes structured data (tables, lists, records) through pipelines rather than just raw text.

## Setup

Ensure `nu` is installed:

```bash
nu --version
```

## Core Concepts

### Pipelines and Tables

Most commands in Nu return a table or a list of records.

```nu
ls | where size > 10mb | sort-by size
```

### Data Types

- **Record**: `{ name: "John", age: 30 }`
- **List**: `[1, 2, 3]`
- **Table**: A list of records with the same keys.

## Data Manipulation

### Loading and Saving

Nu natively supports many formats:

```nu
# Load data
let config = (open config.json)
let data = (open data.csv)

# Save data
$data | save output.yaml
$data | to json | save output.json
```

### Filtering and Selecting

```nu
# Filter rows
ls | where name =~ "test"

# Select columns
ls | select name size

# Accessing fields
(open package.json).version
```

## Scripting

In nu-shell, you can write and run scripts in the nu-shell language. To run a script, pass it as an argument to the `nu` command:

```bash
nu myscript.nu
```

Or run scripts inside the current instance using `source`:

```bash
source myscript.nu
```

### Basic Script Structure

A script file defines custom commands and the main script logic:

```nu
# myscript.nu
def greet [name] {
  ["hello" $name]
}

greet "world"
```

Definitions run first, allowing calls anywhere in the script.

### Parameterizing Scripts

Scripts can have a special "main" command for parameters:

```nu
# myscript.nu
def main [x: int] {
  $x + 10
}
```

```bash
nu myscript.nu 100  # => 110
```

Arguments are typed; if not specified, they're `Type::Any`.

### Subcommands

Scripts can have subcommands like `run` or `build`:

```nu
# myscript.nu
def "main run" [] {
    print "running"
}

def "main build" [] {
    print "building"
}

def main [] {
    print "hello from myscript!"
}
```

```bash
nu myscript.nu build  # => building
```

You must define a `main` command for subcommands to work.

### Shebangs

On Unix-like systems, use shebangs to make scripts executable:

```nu
#!/usr/bin/env nu
"Hello World!"
```

```bash
./myscript  # => Hello World!
```

For stdin access, use `--stdin`:

```nu
#!/usr/bin/env -S nu --stdin
def main [] {
  echo $"stdin: ($in)"
}
```

```bash
echo "Hello World!" | ./myscript  # => stdin: Hello World!
```

## Control Flow

### Variables

```nu
let x = 10
mut y = 20
$y = 30 # Mutable variables need 'mut'
```

### Conditionals

```nu
if $x > 5 {
    print "Greater"
} else {
    print "Smaller or equal"
}
```

### Loops and Iteration

```nu
# For loop
for i in 1..3 { print $i }

# Each (functional style)
[1 2 3] | each { |it| $it * 2 }

# Filter (where)
[1 2 3] | where $it > 1
```

## Custom Commands

Defining a command with typed parameters:

```nu
def greet [name: string, --shout (-s)] {
    let msg = $"Hello, ($name)!"
    if $shout {
        $msg | str upcase
    } else {
        $msg
    }
}

greet "World" --shout
```

### Parameters

- **Required positional**: `def cmd [param: type] { ... }`
- **Optional positional**: `def cmd [param?: type] { ... }`
- **Default value**: `def cmd [param: type = default] { ... }`
- **Flags**: `def cmd [--flag: type, --short (-s)] { ... }`
- **Rest parameters**: `def cmd [...params: type] { ... }`

### Pipeline Input/Output

Custom commands can accept pipeline input via `$in` and return values implicitly (last expression).

```nu
def double [] {
    $in | each { |num| 2 * $num }
}

[1 2 3] | double  # => [2, 4, 6]
```

### Wrapped Commands

Use `def --wrapped` to create commands that extend external commands while passing through their parameters.

```nu
def --wrapped my-ls [...rest] {
    ls -l ...$rest
}
```

### Environment Changes

Use `def --env` to persist environment changes (like `cd` or `$env` modifications) to the caller.

```nu
def --env go-home [] {
    cd ~
}
```

### Subcommands

Define subcommands using spaces in the name:

```nu
def "cmd subcmd" [] { ... }
```

### Documentation

Add comments before `def` for command description and after parameters for parameter descriptions.

```nu
# Command description
def greet [
    name: string  # Parameter description
] { ... }
```

## Environment and Path

```nu
# Set environment variable
$env.FOO = "bar"

# Append to PATH
$env.PATH = ($env.PATH | append "/new/path")
```

## Cheat Sheet

### Common Commands

| Command     | Description                             |
| :---------- | :-------------------------------------- |
| `ls`        | List directory contents as a table.     |
| `open`      | Load a file (auto-detects format).      |
| `save`      | Save data to a file.                    |
| `where`     | Filter rows based on a condition.       |
| `select`    | Select specific columns or fields.      |
| `each`      | Apply a closure to each element.        |
| `get`       | Fetch a specific column or field value. |
| `insert`    | Add a new column to a table.            |
| `update`    | Update an existing column in a table.   |
| `upsert`    | Update or insert a column.              |
| `transpose` | Swap rows and columns.                  |

### Strings and Formatting

- Interpolation: `$"Value is: ($var)"`
- String manipulation: `"hello" | str upcase`
- Path joining: `["path" "to" "file"] | path join`

### Tables

- `first 5`: Get first 5 rows.
- `last 5`: Get last 5 rows.
- `length`: Count elements.
- `flatten`: Flatten nested structures.

## Related Skills

- **jc**: Convert CLI output to JSON for processing with nu-shell's structured data handling.
