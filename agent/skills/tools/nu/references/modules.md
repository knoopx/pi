# Modules and Overlays

Modules organize custom commands, aliases, and variables into reusable units. Overlays manage named scopes for commands and environment variables.

## Creating a Module

Define commands inside a module block:

```nu
# my-module.nu
export def greet [name: string] {
    $"Hello, ($name)!"
}

export def farewell [name: string] {
    $"Goodbye, ($name)!"
}

export let version = "1.0.0"
```

## Using a Module

```nu
use my-module.nu                  # Import all exports into current scope
greet "World"                     # => Hello, World!
version                           # => 1.0.0

# Import specific items
use my-module.nu [ greet ]        # Only import greet
use my-module.nu --help           # Show module help

# Import with alias (namespace)
use my-module.nu [ greeting: greet ]   # Call as greeting "World"
use my-module.nu *                 # Import everything (no prefix)

# Namespace access (no use needed)
my-module.nu greet "World"        # Access via module path
```

## Creating Modules Inline

Define a module without a file:

```nu
module my-mod {
    export def hello [] { "Hello!" }
    export def goodbye [] { "Goodbye!" }
}

use my-mod *
hello                             # => Hello!
```

## Exporting Items

Within a module, use `export` to make items available:

```nu
# my-module.nu
export def process-data [input: record] { ... }
export alias ll = ls -la
export const MAX_SIZE = 1024
export def --env change-dir [path: path] { cd $path }
```

Without `export`, items are private to the module:

```nu
# my-module.nu
def private-helper [] { ... }       # Not accessible outside
export def public-command [] { private-helper }  # Accessible
```

## Modules in config.nu

Persist modules across sessions by adding them to your startup configuration:

```nu
# In ~/.config/nushell/config.nu
use my-scripts/utils.nu *
use my-scripts/git-tools.nu [ commit-status, branch-info ]
```

## Module Path (`$NU_LIB_DIRS`)

Nushell searches specific directories when resolving `use` and `source`. Configure via:

1. **Environment variable**: `$env.NU_LIB_DIRS = [...paths...]` in `env.nu`
2. **Configuration**: Set `$NU_LIB_DIRS` constant in config
3. **Directory structure**: Nushell auto-loads files from vendor autoload dirs

```nu
# List current search paths
$NU_LIB_DIRS

# Add a custom path (in env.nu)
$env.NU_LIB_DIRS = ($env.NU_LIB_DIRS ++ [$nu.vendor-autoload-dirs, "~/.nu-modules"])
```

## Overlays

Overlays are named sets of commands, environment variables, and aliases that can be activated/deactivated:

### Creating an Overlay

```nu
# my-overlay.nu
overlay use my-overlay            # Activate the overlay (from a file)

# Or define inline
overlay new temp-overlay          # Create empty overlay
overlay add temp-overlay {        # Add commands to it
    export def tmp-cmd [] { "temp" }
}
```

### Activating and Deactivating

```nu
use my-scripts/git-tools.nu       # Commands available in current scope

# Create an overlay to isolate commands
overlay new git-workspace
use my-scripts/git-tools.nu --only [ commit-status branch-info ] | into nuon
# Commands are now scoped to the git-workspace overlay

# Deactivate when done
overlay remove git-workspace      # Remove overlay, commands disappear
```

### Viewing Overlays

```nu
overlays                          # List all active overlays
overlay list                      # Same as above
scope overlays                    # Show overlay names
```

## Modules vs Sourcing

| Aspect         | `use module`                       | `source file.nu`              |
| -------------- | ---------------------------------- | ----------------------------- |
| Purpose        | Organize commands into namespaces  | Execute code, set env vars    |
| Reusability    | Import specific items with aliases | Everything runs immediately   |
| Scope          | Items are isolated until `use`     | Runs in current scope         |
| Export control | `export` controls visibility       | No concept of exports         |
| Use case       | Libraries, reusable command sets   | Config loading, one-off setup |

## Module Organization Patterns

### Command Library

```nu
# utils/csv.nu
export def clean-csv [file: path] { ... }
export def validate-csv [file: path, cols: list] { ... }
export def csv-stats [file: path] { ... }

# usage
use utils/csv.nu *
clean-csv data.csv
```

### Git Tool Collection

```nu
# utils/git.nu
export def git-status [] { ^git status --short }
export def git-branches [] { ^git branch -a | lines }
export def git-log [count: int = 10] { ^git log --oneline ...$count }

# usage
use utils/git.nu [ git-status git-branches ]
```

### Subcommand Extension

Extend existing command namespaces with custom subcommands:

```nu
# Extend the 'str' namespace
def "str my-format" [input: string] {
    $input | str upcase | str trim
}

# Now available as: str my-format "hello"
```
