name: knip
description: Identify and remove unused dependencies, files, and exports in TypeScript and JavaScript projects. Use when detecting unused code, cleaning up dead code, improving maintainability, or reducing bundle sizes.
---

# Knip

Knip is a tool to find unused files, dependencies, and exports in TypeScript and JavaScript projects. It helps maintain clean codebases by detecting dead code.

## Setup

No setup required. Knip is run on-demand using `bunx`.

## Usage

Run Knip in the root of your project:

```bash
bunx knip
```

Common options:

- `--fix`: Automatically remove unused dependencies from package.json (use cautiously)
- `--config <file>`: Specify a custom configuration file
- `--include <patterns>`: Include additional file patterns
- `--exclude <patterns>`: Exclude file patterns
- `--reporter <reporter>`: Output format (e.g., json, markdown)
- `--no-config-hints`: Disable configuration hints

Example:

```bash
bunx knip --reporter json --exclude "test/**/*"
```

## Workflow

1. Ensure you're in the project root directory
2. Run Knip to scan for unused code
3. Review the reported unused dependencies, files, and exports
4. Manually remove or refactor the identified unused code
5. Re-run to verify cleanup

## Configuration

Knip can be configured via a `.knip.json` or `knip.config.js` file for custom rules, entry points, and exclusions.

## Supported Environments

Works with TypeScript, JavaScript, and various bundlers/frameworks. It analyzes imports, exports, and dependencies to detect unused code.

## Related Skills

- **bun**: Use Knip to clean up unused dependencies in Bun-managed projects.
- **typescript**: Maintain clean TypeScript codebases by removing unused exports and files.
