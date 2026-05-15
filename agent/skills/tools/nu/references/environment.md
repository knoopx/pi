# Environment Variables and Scoping

Nushell's environment is managed through `$env` with distinct scoping rules compared to traditional shells.

## Accessing and Setting Environment Variables

```nu
$env.HOME                     # Read a variable
$env.PATH                     # PATH is a list (not a string!)
$env.MY_VAR = "value"         # Set a variable
$env.PATH ++= ["~/.local/bin"]  # Append to PATH
$env.PATH = [$env.PATH, "/custom/path"]  # Alternative append
```

## PATH Handling

Nushell converts `$env.PATH` from the shell's colon-separated string into a list at startup. This makes it easy to manipulate:

```nu
# View as list
$env.PATH                     # => [/usr/bin, /bin, ~/.local/bin, ...]

# Append a single path
$env.PATH ++= ["/new/path"]

# Insert at beginning
$env.PATH = ["/first" ++ $env.PATH]

# Check if path exists
if ($env.PATH | any {|p| $p == "/my/path"}) { print "in PATH" }
```

PATH is converted back to a colon-separated string when spawning child processes.

## Environment Scoping

Environment changes in blocks (closures, `do`, `try/catch`, custom commands) are **scoped** — they do not leak out:

```nu
$env.FOO = "before"

do { $env.FOO = "inside" }
$env.FOO                      # => "before" (unchanged)

def foo [] { $env.FOO = "in-command" }
foo
$env.FOO                      # => "before" (unchanged)
```

To make environment changes persist, use `def --env`:

```nu
def --env set-foo [] { $env.FOO = "after" }
$env.FOO = "before"
set-foo
$env.FOO                      # => "after" (persisted!)
```

## Environment Variables in Closures

Closures capture environment variables from their enclosing scope but cannot modify them:

```nu
mut foo = []
[1 2 3] | each { $foo = ($foo | append ($in + 1)) }
# Error: capture of mutable variable

# Use a loop instead (blocks can mutate)
for x in [1 2 3] { $foo = ($foo | append ($x + 1)) }
$foo                          # => [2, 3, 4]
```

## `with-env` — Temporary Environment in a Block

Set environment variables for the duration of a block:

```nu
with-env { KEY: value } {
    ^my-command               # Runs with KEY=value set temporarily
}

# Multiple variables
with-env { API_KEY: secret DB_HOST: localhost } {
    ^my-tool --api-key $env.API_KEY
}
```

## `load-env` / `export-env` — Apply Environment from Record

Load environment variables from a record:

```nu
{ MY_VAR: "value", OTHER: "data" } | load-env
$env.MY_VAR                   # => "value"
```

Preserve environment changes across subshells (use in `env.nu`):

```nu
export-env { $env.MY_VAR = "persistent value" }
```

## Source vs Source-Env

```nu
source script.nu              # Run Nushell script — env changes are scoped
source-env script.nu          # Source and apply environment changes (persist)
```

## Key Environment Variables

### Nushell-Managed Variables

| Variable               | Description                                |
| ---------------------- | ------------------------------------------ |
| `$env.HOME`            | Home directory                             |
| `$env.PWD`             | Current working directory                  |
| `$env.PATH`            | Search path for executables (as a list)    |
| `$env.LAST_EXIT_CODE`  | Exit code of last command (`$?`)           |
| `$env.CMD_DURATION_MS` | Time in ms the previous command took       |
| `$env.SHLVL`           | Shell level (increments for nested shells) |

### Nushell Internal Variables

| Variable               | Description                              |
| ---------------------- | ---------------------------------------- |
| `$env.config`          | Main configuration record                |
| `$env.ENV_CONVERSIONS` | How to convert env vars to Nushell types |
| `$env.NU_LOG_LEVEL`    | Log level for std/log module             |

### System Variables

| Variable               | Description                        |
| ---------------------- | ---------------------------------- |
| `$env.XDG_CONFIG_HOME` | Override config directory location |
| `$env.XDG_DATA_DIR`    | Override data directory location   |

## `$nu` Constant — Nushell Metadata

```nu
$nu.pid                         # PID of current nu process
$nu.is-interactive              # true if running in interactive shell
$nu.is-login                    # true if started as login shell
$nu.config-path                 # Path to config.nu
$nu.env-path                    # Path to env.nu
$nu.history-path                # Command history file path
$nu.home-dir                    # User's home directory
$nu.data-dir                    # Nushell data directory (vendor autoload dirs)
$nu.cache-dir                   # Cache directory for non-essential data
$nu.temp-dir                    # Temporary files directory
$nu.current-exe                 # Full path to nu binary
$nu.os-info                     # OS information record
$nu.startup-time                # Duration: time to start nu
```

## `$env.NU_VERSION`

The current Nushell version, available as an environment variable (exported to child processes):

```nu
$env.NU_VERSION                 # => "0.94.0"
(version).version               # Same value, but not exported to children
```

## Directory Stack

Nushell maintains a directory stack for quick navigation:

```nu
pushd dir1              # Push directory onto stack and cd there
popd                    # Pop and cd to previous directory
dirs                    # List directory stack
```
