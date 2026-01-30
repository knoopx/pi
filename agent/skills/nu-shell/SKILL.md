---
name: nu-shell
description: Processes structured data through pipelines, filters tables, transforms JSON/CSV/YAML, and defines custom commands. Use when scripting with typed parameters or working with tabular data.
---

# nu-shell

Structured data scripting through pipelines with tables, lists, and records.

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

```bash
#!/usr/bin/env nu
# Define custom commands
def "my command" [param: string] {
    echo "Hello, $param"
}

# Main script logic
my command "world"
```

## Related Skills

- **jc**: Convert CLI output to JSON for nu processing
- **toon**: Compact JSON representation
- **scraping**: Web content extraction
