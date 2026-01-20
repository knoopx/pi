---
name: bun
description: Initialize projects, manage dependencies, run scripts, execute tests, and bundle code using Bun. Use when working with package.json, installing packages, running dev servers, or building for production.
---

# Bun Cheatsheet

Fast all-in-one JavaScript runtime, bundler, test runner, and package manager.

## Key Commands

| Command | Description |
|---------|-------------|
| `bun init` | Create new project |
| `bun install` | Install dependencies |
| `bun add <pkg>` | Add package |
| `bun remove <pkg>` | Remove package |
| `bun update` | Update dependencies |
| `bun run <script>` | Run script |
| `bun test` | Run tests |
| `bun build` | Bundle code |
| `bunx <cmd>` | Run package binary |
| `bun audit` | Check for vulnerabilities |
| `bun outdated` | Show outdated packages |
| `bun why <pkg>` | Explain why package is installed |
| `bun publish` | Publish to npm registry |
| `bun patch <pkg>` | Prepare package for patching |

## Project Setup

```bash
bun init                    # Basic project
bun init --react           # React project
bun init --react=tailwind  # React + Tailwind
bun init --react=shadcn    # React + shadcn/ui
```

## Package Management

```bash
bun add <pkg>              # Production dep
bun add -d <pkg>           # Dev dependency
bun add --optional <pkg>   # Optional dep
bun add -g <pkg>           # Global install
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

## Building

```bash
bun build ./src/index.ts              # Bundle
bun build --production ./src/index.ts # Minified
bun build --target=node ./src/index.ts # Node target
bun build --compile ./cli.ts          # Executable
bun build --splitting ./src/index.ts  # Code splitting
```

## Configuration (bunfig.toml)

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

## Workspaces

Root `package.json`:

```json
{
  "workspaces": ["packages/*"],
  "catalog": {
    "react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

Commands:

```bash
bun run --workspaces test    # Run in all workspaces
bun add <pkg> --filter <ws>  # Add to specific workspace
bun remove <pkg> --filter <ws> # Remove from workspace
```

## Environment Variables

```bash
bun run --env-file=.env dev  # Load .env
process.env.VAR             # Access in code
```

## Tips

- Use `bunx` for one-off CLIs (auto-installs)
- Commit `bun.lock` for reproducible installs
- `--frozen-lockfile` in CI to prevent changes
- `bun run -i` auto-installs missing deps
- Standalone executables: `bun build --compile`
- Use tmux for watch/hot modes: `tmux new -d -s dev 'bun run --watch'`
