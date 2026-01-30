# nu-shell Reference

Detailed patterns, examples, and workflows for nu-shell.

## Scripting Patterns

### Basic Script Structure

```bash
#!/usr/bin/env nu
# Define custom commands
def "my command" [param: string] {
    echo "Hello, $param"
}

# Main script logic
my command "world"
```

### Control Flow

```nu
# If statement
if true {
    echo "Hello"
}

# If-else
if true {
    echo "Yes"
} else {
    echo "No"
}

# For loop
for i in 1..10 {
    echo $i
}

# While loop
let i = 1
while $i <= 10 {
    echo $i
    $i = $i + 1
}
```

### Custom Command Examples

```nu
# Command with parameters
def "run tests" [] {
    echo "Running tests..."
    run -c "bunx tsc --noEmit"
    run -c "bunx eslint src/ --fix"
    run -c "vitest run"
}

# Command with typed parameters
def "create project" [name: string, type: string = "typescript"] {
    echo "Creating $name project with $type type"
    bun init --$type --name $name
}

# Command with multiple parameters
def "deploy" [env: string = "production"] {
    echo "Deploying to $env"
    run -c "bun run build"
    run -c "bun run deploy --env $env"
}
```

## Data Manipulation Patterns

### Processing Tables

```nu
# Filter rows based on conditions
ls | where size > 10mb

# Select specific columns
ls | select name size

# Sort by column
ls | sort-by size

# Group by column
ls | group-by name

# Count rows
ls | length
```

### Processing Records

```nu
# Access fields
let user = { name: "John", age: 30, email: "john@example.com" }
echo $user.name

# Update fields
let updated = { ...$user, age: 31 }

# Merge records
let config = { port: 3000, debug: true }
let env = { ...$config, NODE_ENV: "development" }
```

### Processing Lists

```nu
# Filter list
[1, 2, 3, 4, 5] | where $it > 2

# Map list
[1, 2, 3] | each { |x| $x * 2 }

# Reduce list
[1, 2, 3, 4, 5] | reduce { |acc, x| $acc + $x }
```

### File Operations

```nu
# Read file
let content = (open "file.txt")

# Write file
content | save "output.txt"

# Append to file
content | save --append "file.txt"
```

## Common Workflows

### Development Workflow

```bash
# Run all checks
nu -c 'ls | where size > 10mb | sort-by size'

# Process results
nu -c 'ls | where size > 10mb | select name size | to json'
```

### Data Processing Workflow

```nu
# Load data
let data = (open data.csv)

# Process data
let filtered = $data | where age > 18

# Transform data
let transformed = $filtered | each { |row| { ...$row, age_years: $row.age * 365 } }

# Save results
$transformed | to json | save processed.json
```

## Tips

- Use `nu -c 'command'` to run commands in one line
- Use `nu script.nu` to run script files
- Use `source script.nu` to run scripts in current session
- Use `open` to load data from various formats
- Use `save` to save data to various formats
- Use `where` to filter tables
- Use `select` to choose columns
- Use `sort-by` to sort tables
- Use `group-by` to group tables
- Use `each` to map over lists
- Use `reduce` to combine list elements
