---
name: bun
description: Initializes projects, manages dependencies, runs scripts, executes tests, and bundles code using Bun. Use when working with package.json, installing packages, running dev servers, or building for production.
---

# Bun

Fast all-in-one JavaScript runtime, bundler, test runner, and package manager.

## Quick Start

```bash
# Create new project
bun init

# Install dependencies
bun install

# Run a script
bun run ./file.ts

# Run tests
bun test
```

## Contents

- [Package Management](./REFERENCE.md#package-management)
- [Running Code](./REFERENCE.md#running-code)
- [Testing](./REFERENCE.md#testing)
- [Building](./REFERENCE.md#building)
- [Configuration](./REFERENCE.md#configuration)
- [Workspaces](./REFERENCE.md#workspaces)
- [Environment Variables](./REFERENCE.md#environment-variables)

## Package Management

### Installation

```bash
bun add <pkg>              # Production dep
bun add -d <pkg>           # Dev dependency
bun add --optional <pkg>   # Optional dep
bun add -g <pkg>           # Global install
```

### Management

```bash
bun remove <pkg>           # Remove package
bun update                 # Update all
bun outdated               # Show outdated
bun audit                  # Security audit
bun why <pkg>              # Why installed
bun info <pkg>             # Show package metadata
bun publish                # Publish to npm
bun patch <pkg>            # Patch a package
bun link                   # Link local package
bun unlink                 # Unlink local package
```

See [Package Management](./REFERENCE.md#package-management) for details.

## Running Code

```bash
bun run ./file.ts          # Execute file
bun run dev               # Run script
bun -e "code"             # Eval code
bun exec ./script.sh      # Run shell script

# Long-running/watch mode (use tmux for background)
tmux new -d -s dev 'bun run --watch ./file.ts'
tmux new -d -s hot 'bun run --hot ./file.ts'
tmux new -d -s repl 'bun repl'
```

See [Running Code](./REFERENCE.md#running-code) for details.

## Testing

```bash
bun test                   # Run all tests
bun test --coverage       # With coverage
bun test -t "pattern"     # Filter by name
bun test --bail 3         # Stop after N failures
bun test -u               # Update snapshots

# Watch mode (use tmux for background)
tmux new -d -s test 'bun test --watch'
```

See [Testing](./REFERENCE.md#testing) for details.

## Building

```bash
bun build ./src/index.ts              # Bundle
bun build --production ./src/index.ts # Minified
bun build --target=node ./src/index.ts # Node target
bun build --compile ./cli.ts          # Executable
bun build --splitting ./src/index.ts  # Code splitting
```

See [Building](./REFERENCE.md#building) for details.

## Configuration

### bunfig.toml

```toml
[install]
linker = "hoisted"           # or "isolated"
minimumReleaseAge = 259200   # Security (3 days)
optional = true

[test]
timeout = 5000
coverage = { reporter = ["text"] }

[build]
minify = true
sourcemap = "external"
```

See [Configuration](./REFERENCE.md#configuration) for details.

## Workspaces

### Root package.json

```json
{
  "workspaces": ["packages/*"],
  "catalog": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Workspace Commands

```bash
bun run --workspaces test    # Run in all workspaces
bun add <pkg> --filter <ws>  # Add to specific workspace
bun remove <pkg> --filter <ws> # Remove from workspace
```

See [Workspaces](./REFERENCE.md#workspaces) for details.

## Environment Variables

```bash
bun run --env-file=.env dev  # Load .env
process.env.VAR             # Access in code
```

See [Environment Variables](./REFERENCE.md#environment-variables) for details.

## Tips

- Use `bunx` for one-off CLIs (auto-installs)
- Commit `bun.lock` for reproducible installs
- `--frozen-lockfile` in CI to prevent changes
- `bun run -i` auto-installs missing deps
- Standalone executables: `bun build --compile`
- Use tmux for watch/hot modes: `tmux new -d -s dev 'bun run --watch'`

## Related Skills

- **typescript**: TypeScript configuration and type checking
- **vitest**: Test utilities and mocking
- **ast-grep**: Pattern matching for refactoring
