# Bun Reference

Detailed information about Bun features and patterns.

## Package Management

### Installation Commands

```bash
# Add production dependency
bun add <pkg>

# Add development dependency
bun add -d <pkg>

# Add optional dependency
bun add --optional <pkg>

# Add global dependency
bun add -g <pkg>

# Add specific version
bun add <pkg>@^1.0.0

# Add from git repository
bun add <owner>/<repo>
```

### Management Commands

```bash
# Remove package
bun remove <pkg>

# Update dependencies
bun update

# Update specific package
bun update <pkg>

# Show outdated packages
bun outdated

# Check for vulnerabilities
bun audit

# Explain why package is installed
bun why <pkg>

# Show package metadata
bun info <pkg>

# Publish to npm registry
bun publish

# Prepare package for patching
bun patch <pkg>

# Link local package
bun link

# Unlink local package
bun unlink
```

### Package.json Structure

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "type": "module",
  "module": "src/index.ts",
  "exports": ["./src/index.ts", "./src/*.ts"],
  "dependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "vitest": "^0.0.0"
  },
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "test": "bun test"
  }
}
```

## Running Code

### Basic Execution

```bash
# Run a file
bun run ./file.ts

# Run a script
bun run dev

# Evaluate code
bun -e "console.log('Hello')"

# Run shell script
bun exec ./script.sh

# Run with specific working directory
bun run ./dir/file.ts

# Run with arguments
bun run ./cli.ts arg1 arg2
```

### Watch Mode

```bash
# Watch mode (auto-restarts on changes)
bun run --watch ./file.ts

# Hot reload (HMR)
bun run --hot ./file.ts

# Watch multiple files
bun run --watch src/**/*.{ts,tsx,js,jsx}

# Use tmux for background watch mode
tmux new -d -s dev 'bun run --watch ./file.ts'
```

### REPL

```bash
# Start REPL
bun repl

# Run code in REPL
> const x = 1 + 2;
> console.log(x);
3
> exit()
```

### Long-Running Processes

```bash
# Start dev server (use tmux for background)
tmux new -d -s server 'bun run --watch ./server.ts'

# Start production build
tmux new -d -s build 'bun build ./src/index.ts'
```

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/test.ts

# Run tests matching pattern
bun test -t "should validate"

# Run tests matching multiple patterns
bun test -t "should validate" -t "should error"

# With coverage
bun test --coverage

# Verbose output
bun test --verbose

# Stop on first failure
bun test --bail

# Stop after N failures
bun test --bail 3

# Update snapshots
bun test -u

# Watch mode
bun test --watch

# With timeout
bun test --timeout 5000
```

### Test Configuration

```json
{
  "test": {
    "timeout": 5000,
    "coverage": {
      "reporter": ["text", "html"]
    }
  }
}
```

## Building

### Build Commands

```bash
# Bundle code
bun build ./src/index.ts

# Production build (minified)
bun build --production ./src/index.ts

# Target specific platform
bun build --target=node ./src/index.ts
bun build --target=deno ./src/index.ts

# Create standalone executable
bun build --compile ./cli.ts

# Code splitting (for larger projects)
bun build --splitting ./src/index.ts

# Output directory
bun build --outdir ./dist ./src/index.ts
```

### Build Configuration

```json
{
  "build": {
    "target": "node",
    "minify": true,
    "sourcemap": "external",
    "outdir": "dist"
  }
}
```

## Configuration

### bunfig.toml

```toml
# Installation settings
[install]
linker = "hoisted"           # or "isolated"
minimumReleaseAge = 259200   # Security (3 days)
optional = true

# Test settings
[test]
timeout = 5000
coverage = { reporter = ["text"] }

# Build settings
[build]
minify = true
sourcemap = "external"
outdir = "dist"
```

### Environment Variables

```bash
# Load .env file
bun run --env-file=.env dev

# Access environment variables in code
process.env.VAR
process.env.API_KEY

# Set environment variables
VAR=value bun run ./file.ts

# Pass multiple environment variables
VAR1=value1 VAR2=value2 bun run ./file.ts
```

## Workspaces

### Workspace Configuration

```json
{
  "workspaces": ["packages/*"],
  "catalog": {
    "react": "^18.0.0",
    "typescript": "^5.0.0",
    "vitest": "^0.0.0"
  }
}
```

### Workspace Commands

```bash
# Run in all workspaces
bun run --workspaces test

# Run in specific workspace
bun run --workspaces packages/* -- filter test

# Add package to all workspaces
bun add <pkg>

# Add package to specific workspace
bun add <pkg> --filter <ws>

# Remove package from all workspaces
bun remove <pkg>

# Remove package from specific workspace
bun remove <pkg> --filter <ws>

# Update packages in all workspaces
bun update

# Check outdated packages in workspaces
bun outdated --workspaces
```

## Tips

### Usage Tips

- Use `bunx` for one-off CLIs (auto-installs)
- Commit `bun.lock` for reproducible installs
- Use `--frozen-lockfile` in CI to prevent changes
- Use `bun run -i` auto-installs missing deps
- Standalone executables: `bun build --compile`
- Use tmux for watch/hot modes: `tmux new -d -s dev 'bun run --watch'`

### Best Practices

- Keep `package.json` minimal - use `bunfig.toml` for complex config
- Use workspaces for monorepos
- Always commit `bun.lock` for reproducibility
- Use `--frozen-lockfile` in CI
- Use `--silent` for less verbose output
- Use `--verbose` for debugging

### Performance Tips

- Use `--splitting` for larger projects
- Use `--production` for builds
- Use `--compile` for standalone executables
- Use `--minify` to reduce bundle size
- Use `--sourcemap` for debugging (disable in production)

### Troubleshooting

- **Package not found**: Check `bun.lock` and run `bun install`
- **Build errors**: Check `bunfig.toml` configuration
- **Test failures**: Run `bun test --verbose` for details
- **Performance issues**: Check for circular dependencies
- **Version conflicts**: Update packages with `bun update`
