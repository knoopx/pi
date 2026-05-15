# Writing Nushell Scripts (`.nu` files)

Nushell scripts are `.nu` files that can be executed directly from the command line or sourced into the current session.

## Shebang and Execution

Start a script with the shebang to make it executable:

```nu
#!/usr/bin/env nu

# Script content
let dir = ($env.CURRENT_FILE | path dirname)
print $"Script directory: ($dir)"
```

Make it executable: `chmod +x script.nu`, then run as `./script.nu`.

## Passing Arguments to Scripts

Arguments are available as parameters:

```nu
#!/usr/bin/env nu

def my-script [filename: string, --verbose] {
    if $verbose { print $"Opening ($filename)" }
    open $filename | length | print
}

my-script data.csv --verbose
```

Run from command line: `nu script.nu data.csv --verbose`

For the special `$nu.script-arguments` variable (all arguments as a list):

```nu
let args = $nu.script-arguments
for arg in $args { print $arg }
```

## `source` vs Executing Scripts

| Aspect        | `source script.nu`            | `nu script.nu` (execute) |
| ------------- | ----------------------------- | ------------------------ |
| Scope         | Runs in current scope         | New subshell             |
| Env changes   | Persist after sourcing        | Lost when script ends    |
| Variables set | Available after source        | Only inside script       |
| Use case      | Load config, define functions | Standalone tool          |

```nu
source script.nu               # Load into current session
source-env script.nu           # Source and apply environment changes
```

## `config nu` — Config File Paths

Nushell loads configuration from:

- **`config.nu`**: Main config (aliases, custom commands, env config)
- **`env.nu`**: Environment variables, prompt configuration, hooks
- **`login.nu`**: Runs for login shells only
- **`plugin.msgpackz`**: Plugin registry

Find paths programmatically:

```nu
$nu.config-path               # Path to config.nu
$nu.env-path                  # Path to env.nu
$nu.history-path              # Command history file
$nu.default-config-dir        # Config directory (~/.config/nushell on Linux)
```

## Script Structure Best Practices

### 1. Validate Environment Early

```nu
#!/usr/bin/env nu

# Ensure required tools exist
if not (^which git | describe) == "nothing" {
    print "git is available"
} else {
    error make { msg: "git is required but not found" }
}

# Check for required arguments
if $nu.script-arguments | length == 0 {
    print "Usage: script.nu <input-file>"
    return 1
}
```

### 2. Use `try/catch` for Robustness

```nu
try {
    open $input_file | where status == "active"
} catch { |err|
    print $"Failed to read file: ($err.msg)"
    exit 1
}
```

### 3. Set Exit Codes

```nu
#!/usr/bin/env nu

let data = (try { open config.json } catch { null })
if $data == null {
    print "Config not found"
    exit 2                          # Non-zero exit signals failure
}

# Process...
print "Done!"
exit 0                              # Explicit success (optional)
```

### 4. Use `path self` for Script-Relative Paths

```nu
let script_dir = ($env.CURRENT_FILE | path dirname)
let data_file = (path join $script_dir "data.json")
open $data_file
```

Or via constant:

```nu
let script_dir = (path self | path dirname)
```

### 5. Handle Missing Files Gracefully

```nu
def read-config [file: path] {
    try { open $file } catch {
        print $"Config file not found: ($file)"
        null
    }
}
```

## Common Script Patterns

### File Processor

```nu
#!/usr/bin/env nu
# process.nu — Process all CSV files in a directory

def process-dir [dir: path] {
    ls $dir | where type == file | where name =~ "\.csv$"
    | each {|file|
        open $file.name
        | where status != "deleted"
        | save ($file.name | str replace ".csv" "_clean.csv")
    }
}

process-dir .
```

### API Consumer

```nu
#!/usr/bin/env nu
# fetch.nu — Fetch and parse data from an API

def fetch-data [url: string] {
    try {
        http get $url | from json
    } catch { |err|
        error make { msg: $"Failed to fetch ($url): ($err.msg)" }
    }
}

let data = (fetch-data "https://api.example.com/data.json")
$data | where active == true | save active_data.json
```

### Interactive Prompt Script

```nu
#!/usr/bin/env nu
# interactive.nu — Collect user input and process it

let name = (input "Enter your name: ")
let age = (input "Enter your age: " | into int)

if $age >= 18 {
    print $"Welcome, ($name)! You are of age."
} else {
    print $"Hi ($name)! Please bring a guardian."
}
```

## Debugging Scripts

- Use `print` to output debug values at specific points
- Use `inspect` to see values as they flow through pipelines: `open data.csv | inspect | where ...`
- Run with `nu -c "source script.nu; some-command"` to test interactively
- Set `$env.NU_LOG_LEVEL = "debug"` for std/log debugging
