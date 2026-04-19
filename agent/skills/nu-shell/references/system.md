# System Interaction and Environment

Nushell provides built-in commands for filesystem, process management, system info, and environment variable management.

## Filesystem Commands

### `ls` — List Directory Contents

Returns a table (not text), making it easily filterable and transformable:

```nu
ls                              # All entries in current directory
ls *.js                         # Glob pattern filter
ls /var/log/                    # Specific directory

# Filter by type (table columns: name, type, size, modified, etc.)
ls | where type == file         # Files only
ls | where type == dir          # Directories only

# Sort and transform
ls | sort-by size | reverse     # Largest first
ls | select name size modified  # Pick columns
```

### `open` — Read a File

Auto-detects format from extension; use `--raw` to read without parsing:

```nu
open data.csv                   # CSV → table
open data.json                  # JSON → record or list
open config.yaml                # YAML → record
open image.jpg | into binary    # Binary file
open data.txt --raw             # Raw text (no format detection)
open data.csv --trim            # Trim whitespace from headers and values
```

### `save` — Write a File

Fails by default if the target exists; use `-f` (`--force`) to overwrite:

```nu
$table | save output.csv                # Fails if exists
$data | save -f output.csv              # Overwrites
$record | to json > output.json         # Pipe redirect (no overwrite check)
```

### `mkdir`, `cp`, `mv`, `rm`, `touch` — File Operations

```nu
mkdir dir1 dir2 subdir/nested           # Create directories (including parents)
cp source.txt dest.txt                  # Copy file
cp -r src_dir/ dest_dir/                # Copy directory recursively
mv old.txt new.txt                      # Rename/move file
rm unwanted.txt                         # Remove file(s)
touch empty.file                        # Create empty file (or update timestamp)
```

### `du` — Disk Usage

Returns a table of disk usage for files/directories:

```nu
du                                # Current directory
du --all                          # All files, not just directories
du | sort-by size | reverse       # Largest first
```

### `glob` — Create List from Glob Pattern

Returns a list of paths matching a glob pattern:

```nu
glob "*.js"                       # All .js files in current dir
glob -r "**/*.rs"                 # Recursive glob
```

### `path` — Path Manipulation

| Command            | Description                          | Example                                        |
| ------------------ | ------------------------------------ | ---------------------------------------------- |
| `path basename`    | Last component of path               | `"a/b/file.txt" \| path basename` → `file.txt` |
| `path dirname`     | Parent directory                     | `"a/b/file.txt" \| path dirname` → `a/b`       |
| `path exists`      | Check if path exists                 | `$path \| path exists` → `bool`                |
| `path expand`      | Absolute path                        | `"~/docs" \| path expand`                      |
| `path join`        | Join path parts                      | `path join "a" "b" "c"` → `a/b/c`              |
| `path parse`       | Structured path data                 | `"a/b.txt" \| path parse` → {dir, stem, ext}   |
| `path relative-to` | Relative path between two paths      |                                                |
| `path split`       | Split into components                | `"a/b/c" \| path split` → [a, b, c]            |
| `path type`        | Check file type (file, dir, symlink) |                                                |

## Process Management

### `ps` — List Processes

Returns a table with process information:

```nu
ps                              # All processes
ps | where cpu > 0 | sort-by cpu | reverse   # Highest CPU first
ps | where name == "nu" | get pid.0           # Get PID of specific process
ps | where name == "nu" | get pid.0 | kill $in  # Kill by PID
```

### `kill` — Send Signal to Process

Nushell's built-in `kill` works cross-platform:

```nu
kill <pid>                      # Send termination signal
^kill -9 <pid>                  # External Unix kill with force flag (Unix only)
```

## System Information

### `sys` — System Overview and Categories

Returns a record with categories as fields. Use subcommands for details:

| Command     | Description            | Output Columns                                      |
| ----------- | ---------------------- | --------------------------------------------------- |
| `sys`       | Overall system info    | Host, memory, disks, CPUs, users, temps             |
| `sys host`  | Host information       | os, kernel, hostname, version, arch, etc.           |
| `sys mem`   | Memory usage           | total, free, used, available, buffers, cached       |
| `sys cpu`   | CPU info               | per-core utilization and frequency                  |
| `sys disks` | Disk devices           | name, mount_point, type, removable, size, available |
| `sys net`   | Network interfaces     | name, state, receive/transmit bytes                 |
| `sys temp`  | Component temperatures | component, temperature                              |
| `sys users` | Logged-in users        | user, terminal, login_time, host                    |

```nu
sys mem | json                  # Memory info as JSON string
sys | to yaml                   # All system info as YAML
```

### `uname`, `whoami` — Basic System Queries

```nu
uname                           # OS/kernel information
whoami                          # Current username
pwd                             # Current working directory (absolute path)
```

## Environment Variables

### Setting and Modifying `$env`

```nu
$env.MY_VAR = "value"           # Set environment variable
$env.PATH ++= ["~/.local/bin"]  # Append to PATH list
$env.PATH = [$env.PATH, "/custom/path"]  # Alternative append
```

To make changes persistent across Nushell sessions, edit `config.nu` and `env.nu`:

```nu
config nu                     # Open ~/.config/nushell/config.nu in editor
config env                    # Open ~/.config/nushell/env.nu in editor
vim $nu.env-path              # Directly open config file
```

### Reading Environment Variables

```nu
$env.HOME                     # Home directory
$env.PATH                     # Path list
$env.MY_VAR                   # Custom variable
$env                          # List all environment variables
```

### `with-env` — Temporarily Set Environment in a Block

```nu
with-env { KEY: value } {
    ^my-command               # Runs with KEY=value set temporarily
}
```

### `load-env` / `export-env` — Apply Environment from Record

```nu
# Load environment variables from a record
{ MY_VAR: "value", OTHER: "data" } | load-env

# Preserve environment changes across subshells (use in env.nu)
export-env { $env.MY_VAR = "persistent value" }
```

### `source` / `source-env` — Execute Script Files

```nu
source script.nu              # Run Nushell script in current scope
source-env script.nu          # Source and apply environment changes
```

## Running External Commands

External commands (prefixed with `^`) return strings on stdout. Pipe through Nushell's parsing commands to convert to structured data:

```nu
# Direct external command execution
^ls -la                       # List files (returns table via ls nu command instead)
^df -h                        # Disk usage (raw text)

# Parse external output into tables
^df -h | detect columns                   # Auto-detect column structure
^ps aux | from ssv --aligned-columns      # Space-separated values
^docker ps --format "{{.Names}}" | lines  # One name per line → list of strings
^cargo search shells --limit 5 \| lines | parse "{name} = {version} #{desc}"

# Capture structured output including exit code and stderr
do { ^my-command arg1 } | complete        # Returns record with: exit_code, stdout, stderr
```

### `complete` — Command Result Record

The `complete` command wraps an external command and returns a structured record:

```nu
let result = do { ^ls /nonexistent } | complete
$result.exit_code    # Non-zero on failure
$result.stdout       # Parsed nu value (or raw text if not parseable)
$result.stderr       # Error message from stderr
```

### Running External Commands via Interpolation

Build command strings dynamically with string interpolation and `^`:

```nu
let cmd = "ls"
let args = ["-la", "/var"]
^$"($cmd)" ...$args    # Executes: ls -la /var
```

## Directory Stack

Nushell maintains a directory stack for quick navigation:

```nu
pushd dir1              # Push directory onto stack and cd there
popd                    # Pop and cd to previous directory
dirs                    # List directory stack
```

## Keybindings

```nu
keybindings list                    # Available keybinding options
keybindings default                 # Reset to defaults
```
