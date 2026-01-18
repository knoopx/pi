---
name: bun
description: Manage JavaScript/TypeScript projects, including dependency management, bundling, testing, and runtime execution with Bun. Use when working with JavaScript/TypeScript projects, managing dependencies, building for production, or running tests.
---

# Bun Skill

Bun is a fast all-in-one JavaScript runtime, package manager, bundler, and test runner written in Zig. It replaces Node.js, npm/yarn, esbuild, and Vitest with a single tool.

## Core Concepts

- **Runtime**: Execute JavaScript and TypeScript directly without compilation
- **Package Manager**: Fast npm-compatible package installation with `bun install`, `bun add`
- **Bundler**: Built-in bundling for web apps and Node.js servers
- **Test Runner**: Fast testing framework with `bun test`
- **TypeScript Support**: Native TypeScript execution without configuration
- **Auto Install**: Automatically installs dependencies when imports are found

## Project Initialization

### Create a New Project

```bash
# Initialize a Bun project with defaults
bun init

# Accept all defaults without prompts
bun init -y

# Minimal setup (only type definitions)
bun init --minimal

# React project
bun init --react

# React with TailwindCSS
bun init --react=tailwind

# React with shadcn/ui
bun init --react=shadcn

# Initialize in specific directory
bun init my-app
bun init --react my-app
```

### Output

Bun creates:

- `package.json` - Project metadata and dependencies
- `tsconfig.json` - TypeScript configuration
- `bunfig.toml` - Bun-specific configuration

## Package Management

### Installing Dependencies

```bash
# Install all dependencies from package.json
bun install

# Alias
bun i

# Install production dependencies only (skip devDependencies)
bun install --production

# Install without updating lockfile
bun install --no-save

# Reinstall with latest versions
bun install --force

# Frozen lockfile (fails if changes needed)
bun install --frozen-lockfile

# Install globally
bun install -g package-name

# Dry run without making changes
bun install --dry-run
```

### Adding Dependencies

```bash
# Add production dependency
bun add zod
bun add lodash@^4.17.0

# Add development dependency
bun add -d typescript
bun add --dev vitest

# Add optional dependency
bun add --optional optional-package

# Add peer dependency
bun add --peer some-package

# Add exact version (no caret)
bun add -E zod@3.0.0

# Add from Git
bun add git+https://github.com/user/repo.git

# Add specific branch/tag
bun add --git-url=https://github.com/user/repo.git --git-tag=v1.0.0

# Install and trust a package
bun add --trust package-name

# Global installation
bun add -g package-name
```

### Removing Dependencies

```bash
# Remove dependency
bun remove zod

# Remove development dependency
bun remove -d typescript

# Remove globally
bun remove -g package-name

# From all workspace packages
bun remove --filter workspace-pattern package
```

### Updating Dependencies

```bash
# Update all outdated dependencies
bun update

# Update specific dependency
bun update lodash

# Show outdated packages
bun outdated

# Audit for vulnerabilities
bun audit

# Check why a package is installed
bun why zod
```

### Package Information

```bash
# Display package metadata from registry
bun info zod

# Show why a package is installed
bun why lodash

# List workspace information
bun pm ls
bun pm cache
```

## Running Code

### Execute Scripts

```bash
# Run TypeScript/JavaScript file directly
bun run ./src/index.ts
bun run script.js

# Evaluate code inline
bun -e "console.log(1 + 1)"

# Print expression result
bun -p "2 * 5"

# Watch mode (auto-restart on changes): `tmux new -d 'bun run --watch ./src/index.ts'`

# Hot reload (preserves state): `tmux new -d 'bun run --hot ./src/index.ts'`

# Auto-install missing dependencies
bun run -i ./script.ts

# Run with specific conditions
bun run --conditions=import ./script.ts

# Preload modules before execution
bun run --preload=./setup.ts ./app.ts
```

### Package.json Scripts

```bash
# Run a script from package.json
bun run dev
bun run build
bun run test

# Run scripts in all workspace packages
bun run --workspaces test

# Run scripts matching pattern
bun run --filter workspace-pattern test

# Use system shell instead of Bun's
bun run --shell=system build

# Run with environment file
bun run --env-file=.env.local dev
```

### Interactive REPL

```bash
# Start interactive REPL
bun repl

# Run TypeScript in REPL
> const x = 5;
> console.log(x * 2);
10
```

### Direct Shell Execution

```bash
# Execute shell script directly with Bun
bun exec ./setup.sh

# With arguments
bun exec ./script.sh arg1 arg2
```

## Package Binaries with bunx

```bash
# Run a package binary (installs if needed)
bunx vite --version

# Run with arguments
bunx tsup src/index.ts

# Use specific version
bunx @latest prettier --write .

# Install and run package globally
bunx -g prettier --write .
```

## Testing with Bun

### Running Tests

```bash
# Run all tests
bun test

# Run specific test files
bun test tests/math.test.ts
bun test src/utils.test.ts

# Run tests matching pattern
bun test src/
bun test foo bar  # Files with "foo" or "bar"

# Run tests with names matching pattern
bun test --test-name-pattern "math"
bun test -t "should add"

# Only run tests marked with .only()
bun test --only

# Include tests marked with .todo()
bun test --todo

# Watch mode (re-run on changes): `tmux new -d 'bun test --watch'`

# Exit after N failures
bun test --bail 3

# Run with concurrency limit
bun test --max-concurrency 5

# Run tests serially
bun test --max-concurrency 1

# Randomize test order
bun test --randomize
bun test --randomize --seed 12345

# Update snapshots
bun test -u
bun test --update-snapshots
```

### Test Coverage

```bash
# Generate coverage report
bun test --coverage

# Specify coverage reporter format
bun test --coverage --coverage-reporter=text
bun test --coverage --coverage-reporter=lcov

# Custom coverage directory
bun test --coverage --coverage-dir=./coverage

# Both text and lcov
bun test --coverage --coverage-reporter=text --coverage-reporter=lcov
```

### Test Output and Reporting

```bash
# Dots reporter
bun test --dots

# JUnit reporter (for CI)
bun test --reporter=junit --reporter-outfile=results.xml

# Only show failures
bun test --only-failures

# Pass even if no tests found
bun test --pass-with-no-tests

# Rerun each test multiple times
bun test --rerun-each 5
```

## Bundling

### Build Bundles

```bash
# Bundle for production
bun build ./src/index.ts

# Specify output file
bun build --outfile=dist/bundle.js ./src/index.ts

# Multiple entrypoints
bun build --outdir=dist ./src/index.ts ./src/worker.ts

# Watch mode
bun build --watch ./src/index.ts

# Hot reload
bun build --hot ./src/index.ts
```

### Target Environments

```bash
# Browser bundle (default)
bun build --target=browser ./src/index.ts

# Bun runtime bundle
bun build --target=bun --outfile=server.js ./src/server.ts

# Node.js bundle
bun build --target=node ./src/index.ts
```

### Minification and Optimization

```bash
# Production build (minified, NODE_ENV=production)
bun build --production ./src/index.ts

# Minify all
bun build --minify ./src/index.ts

# Minify syntax only
bun build --minify-syntax ./src/index.ts

# Minify whitespace only
bun build --minify-whitespace ./src/index.ts

# Minify identifiers only
bun build --minify-identifiers ./src/index.ts

# Keep function/class names
bun build --minify --keep-names ./src/index.ts

# Source maps
bun build --sourcemap=inline ./src/index.ts
bun build --sourcemap=external ./src/index.ts
bun build --sourcemap=linked ./src/index.ts
```

### Code Splitting and Advanced Options

```bash
# Enable code splitting
bun build --splitting --outdir=dist ./src/index.ts

# CSS chunking (reduce duplicates)
bun build --css-chunking --outdir=dist ./src/index.ts

# No bundling (transpile only)
bun build --no-bundle ./src/index.ts

# External modules (don't bundle)
bun build -e react -e react-dom ./src/index.ts

# Module format
bun build --format=esm ./src/index.ts
bun build --format=cjs ./src/index.ts
bun build --format=iife ./src/index.ts

# Add banner/footer
bun build --banner="'use client'" --outfile=out.js ./src/index.ts
bun build --footer="// built with bun" ./src/index.ts
```

### Compile to Standalone Executable

```bash
# Create standalone executable
bun build --compile --outfile=my-app ./cli.ts

# Windows-specific options
bun build --compile --windows-icon=icon.ico ./app.ts
bun build --compile --windows-title="My App" ./app.ts
bun build --compile --windows-version=1.0.0.0 ./app.ts

# Hide console on Windows
bun build --compile --windows-hide-console ./gui-app.ts
```

## Configuration

### bunfig.toml

```toml
# Bun configuration file

[install]
# Use Bun's node_modules linker strategy
# "isolated" or "hoisted" (default)
linker = "hoisted"

# Save text-based lockfile (human-readable)
save-text-lockfile = false

# Root workspace
root = "."

# Custom registry
registry = "https://registry.npmjs.org/"

[run]
# Shell to use for scripts ("bun" or "system")
shell = "bun"

# Root path
root = "."

[test]
# Root directory
root = "."

# Test timeout in milliseconds
timeout = 5000

# Coverage threshold (%)
# coverage-threshold = 80

[build]
# Root directory for entrypoints
root = "."

# Naming patterns
entry-naming = "[dir]/[name].[ext]"
chunk-naming = "[name]-[hash].[ext]"
asset-naming = "[name]-[hash].[ext]"

# Keep original names when minifying
keep-names = false

# Minify by default
minify = { whitespace = true, identifiers = true, syntax = true }
```

## Environment Variables

### Loading .env Files

```bash
# Load from .env automatically
bun run dev

# Load from specific file
bun run --env-file=.env.local dev

# Load multiple files
bun run --env-file=.env --env-file=.env.local dev

# Disable .env loading
bun run --no-env-file dev

# Access in code
process.env.DATABASE_URL
```

## Workspaces

### Monorepo Setup

Structure:

```
workspace/
├── package.json          # Root with "workspaces" field
├── bunfig.toml
├── packages/
│   ├── pkg-a/
│   │   └── package.json
│   └── pkg-b/
│       └── package.json
```

Root `package.json`:

```json
{
  "workspaces": ["packages/*"]
}
```

### Workspace Commands

```bash
# Install all workspace dependencies
bun install

# Run script in all workspaces
bun run --workspaces test
bun run --workspaces build

# Run script in matching workspaces
bun run --filter=@workspace/pkg-a test

# Add dependency to specific workspace package
bun add zod --filter=@workspace/pkg-a

# Remove from workspace package
bun remove lodash --filter=@workspace/pkg-b
```

## Publishing Packages

```bash
# Check package readiness
bun build

# Publish to npm
bun publish

# Dry run (no actual publish)
bun publish --dry-run

# Specific registry
bun publish --registry=https://registry.npmjs.org/
```

## Linking Local Packages

```bash
# Register a local package for development
bun link

# Link local package into another project
bun link ../path/to/package

# Unlink
bun unlink
```

## Troubleshooting

### Cache Management

```bash
# Show cache directory
bun cache dir

# Clear cache
bun cache rm

# Skip cache
bun install --no-cache
bun run --no-cache dev
```

### Debugging

```bash
# Verbose output
bun install -v
bun run --verbose dev

# Inspect code execution
bun run --inspect ./app.ts

# Inspect with breakpoint on first line
bun run --inspect-brk ./app.ts

# CPU profiling
bun run --cpu-prof ./app.ts

# Memory profiling (smol mode)
bun run --smol ./app.ts
```

### Common Issues

```bash
# Force reinstall of all dependencies
bun install --force

# Resolve platform-specific dependencies
bun install --cpu=x64
bun install --os=linux
bun install --cpu=* --os=*

# Ignore lifecycle scripts
bun install --ignore-scripts

# Verify package integrity
bun install --verify
bun install --no-verify
```

## Common Workflows

### New TypeScript Project

```bash
# 1. Create project
bun init -y

# 2. Add dev dependencies
bun add -d typescript vitest @types/bun

# 3. Create source files
mkdir -p src tests

# 4. Write code and tests

# 5. Run tests
bun test

# 6. Build if needed
bun build --outfile=dist/index.js ./src/index.ts
```

### Development Loop

```bash
# Terminal 1: Watch and run tests
bun test --watch

# Terminal 2: Watch and run code
bun run --watch ./src/index.ts

# Terminal 3: Other tasks
bun run build
```

### Adding Dependencies During Development

```bash
# Add library
bun add axios

# Add TypeScript types
bun add -d @types/node

# Add dev tools
bun add -d prettier eslint
```

### Build for Production

```bash
# Build optimized bundle
bun build --production --outfile=dist/app.js ./src/index.ts

# Build standalone executable
bun build --compile --outfile=myapp ./cli.ts

# Test production build
./dist/app.js

# Or if executable
./myapp
```

## Best Practices

1. **Commit Lockfile**: Always commit `bun.lockb` to version control for reproducible installs
2. **Package Metadata**: Keep `package.json` organized with clear dependency groups
3. **TypeScript by Default**: Use TypeScript for type safety without extra configuration
4. **Test Continuously**: Use `bun test --watch` during development
5. **Use bunx for Tools**: Run CLIs with `bunx` instead of installing globally
6. **Environment Files**: Use `.env` files for configuration, load with `--env-file`
7. **Workspace Pattern**: Organize monorepos with `workspaces` field in root `package.json`
8. **Pre-commit**: Hook `bun install --frozen-lockfile` in CI to prevent lockfile changes
9. **Fast Iteration**: Leverage Bun's speed with `--watch` and `--hot` modes
10. **Document Scripts**: Use descriptive names in `package.json` scripts section

## Related Skills

- **typescript**: Follow TypeScript best practices when developing with Bun, as Bun provides native TypeScript support.
- **vitest**: Use Vitest as an alternative or complementary testing framework in Bun projects for advanced testing features.
- **knip**: Identify and remove unused dependencies in Bun-managed JavaScript/TypeScript projects.
