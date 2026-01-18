# Codemapper Extension

A Pi Coding Agent extension that provides comprehensive code analysis tools via the `cm` (codemapper) command-line tool.

## Installation

This extension requires the `cm` tool to be installed and available in your PATH.

```bash
# Install via cargo (if available)
cargo install codemapper

# Or via a package manager
brew install codemapper  # macOS
apt-get install codemapper  # Debian/Ubuntu
```

## Tools

The extension registers 8 tools for code analysis:

### 1. **code-stats** - Code Statistics

Display comprehensive statistics about a codebase including file counts, lines of code, and language distribution.

**Parameters:**

- `path` (optional): Path to analyze (defaults to current directory)

**Example:**

```
Analyze the current project statistics
```

### 2. **code-map** - Code Map

Create a hierarchical overview of the codebase structure at different detail levels.

**Parameters:**

- `patterns` (optional): Array of glob patterns to include files
- `budget` (optional): Token budget to auto-reduce detail
- `exportedOnly` (optional): Only show exported symbols
- `noComments` (optional): Exclude JSDoc comments
- `noImports` (optional): Exclude import lists
- `output` (optional): Output format ('text' or 'json')

**Example:**

```
Generate a map of the src directory with exported symbols only
```

### 3. **code-query** - Code Query

Search for functions, classes, and symbols across the codebase with fuzzy or exact matching.

**Parameters:**

- `query` (required): Search query (function name, class name, etc.)
- `exact` (optional): Use exact matching instead of fuzzy search
- `showBody` (optional): Include the actual code implementation
- `exportsOnly` (optional): Only show exported/public symbols

**Example:**

```
Find all functions named authenticate
```

### 4. **code-inspect** - Code Inspect

Examine the structure and symbols within a specific file.

**Parameters:**

- `file` (required): Path to the file to inspect

**Example:**

```
Inspect the src/auth.ts file
```

### 5. **code-callers** - Code Callers

Find all locations where a specific function or symbol is used (reverse dependencies).

**Parameters:**

- `symbol` (required): Symbol name to find callers for

**Example:**

```
Find all callers of the process_payment function
```

### 6. **code-callees** - Code Callees

Find all functions and symbols called by a specific function (forward dependencies).

**Parameters:**

- `symbol` (required): Symbol name to find callees for

**Example:**

```
Find all functions called by process_payment
```

### 7. **code-trace** - Code Trace

Trace the call path between two functions or symbols.

**Parameters:**

- `from` (required): Starting symbol
- `to` (required): Target symbol

**Example:**

```
Trace the call path from main to process_payment
```

### 8. **code-deps** - Code Dependencies

Analyze import and dependency relationships in the codebase, including circular dependency detection.

**Parameters:**

- `file` (optional): File path to analyze dependencies for
- `reverse` (optional): Show reverse dependencies (who imports this file)
- `depth` (optional): Limit dependency tree depth
- `external` (optional): List all external packages used
- `circular` (optional): Find circular dependencies

**Examples:**

```
Analyze dependencies in src/main.ts with depth 3
List all external packages used in the project
Find circular dependencies in the codebase
```

## Usage

All tools are integrated into the Pi Coding Agent and can be used through the agent interface. Use them for:

- **Understanding code structure**: Use `code-map` and `code-inspect` to explore project organization
- **Finding code elements**: Use `code-query` to search for functions, classes, and methods
- **Analyzing impact**: Use `code-callers` and `code-callees` to understand dependencies
- **Refactoring safely**: Use `code-trace` and `code-deps` to understand call paths before making changes
- **Maintaining code quality**: Use `code-stats` to track metrics and find circular dependencies

## Requirements

- `cm` (codemapper) command-line tool installed and in PATH
- The extension works with multiple languages: Python, JavaScript/TypeScript, Go, Rust, Java, C/C++, C#, Ruby, PHP, YAML, and more
