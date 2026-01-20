# ast-grep Extension

Tools for structural code search and rewriting using ast-grep.

## Installation

This extension requires the `ast-grep` CLI tool to be installed on your system.

Install via your package manager:
- macOS: `brew install ast-grep`
- Linux: `cargo install ast-grep` or download from GitHub releases
- Windows: Download from GitHub releases

## Tools

### ast-search

**Label:** AST Search

**Description:** Search for code patterns using structural AST matching.

Use this to:
- Find complex code patterns across files
- Locate function calls, variable usages, or syntax patterns
- Analyze code structure without regex limitations
- Debug and understand code relationships

Supports pattern variables and multiple languages.

**Parameters:**
- `pattern` (string): The ast-grep pattern to search for (e.g., 'console.log($$$ARGS)')
- `language` (enum): Programming language for AST parsing [javascript, typescript, tsx, html, css, python, go, rust, java, c, cpp, csharp, ruby, php, yaml]
- `path` (string, optional): Directory or file to search in (default: current directory)

**Examples:**
- Find console.log calls: `pattern='console.log($$$ARGS)', language='javascript'`
- Find React useEffect hooks: `pattern='useEffect(() => { $$$BODY }, [$DEPS])', language='tsx'`
- Find async functions: `pattern='async function $NAME($$$ARGS) { $$$BODY }', language='typescript'`

### ast-replace

**Label:** AST Replace

**Description:** Perform safe structural search and replace operations.

Use this to:
- Refactor code patterns across multiple files
- Apply consistent changes to similar code structures
- Transform function signatures or variable names
- Automate code modernization tasks

Always use dry-run first to preview changes.

**Parameters:**
- `pattern` (string): The ast-grep pattern to match
- `rewrite` (string): The replacement pattern using $VAR references
- `language` (enum): Programming language for AST parsing [javascript, typescript, tsx, html, css, python, go, rust, java, c, cpp, csharp, ruby, php, yaml]
- `path` (string, optional): Directory or file to search in (default: current directory)
- `dryRun` (boolean, optional): Preview changes without applying them (default: true)

**Examples:**
- Replace == with ===: `pattern='$A == $B', rewrite='$A === $B', language='javascript'`
- Convert function to arrow: `pattern='function $NAME($$$ARGS) { $$$BODY }', rewrite='const $NAME = ($$$ARGS) => { $$$BODY }', language='javascript'`
- Simplify boolean return: `pattern='if ($COND) { return true } else { return false }', rewrite='return !!$COND', language='javascript'`

### ast-scan

**Label:** AST Scan

**Description:** Perform advanced structural searches with complex rule conditions.

Use this to:
- Find code patterns with logical combinations
- Search for nested structures or relationships
- Analyze code quality and patterns
- Create custom linting or analysis rules

Supports 'all', 'any', 'not', 'inside', 'has' operators.

**Parameters:**
- `rule` (string): Inline rule in JSON format (e.g., '{"kind": "function_declaration", "has": {"pattern": "await $EXPR"}}')
- `language` (enum): Programming language for AST parsing [javascript, typescript, tsx, html, css, python, go, rust, java, c, cpp, csharp, ruby, php, yaml]
- `path` (string, optional): Directory or file to search in (default: current directory)

**Examples:**
- Find async functions: `rule='{"kind": "function_declaration", "has": {"pattern": "await $EXPR"}}', language='javascript'`
- Find functions with multiple returns: `rule='{"kind": "function_declaration", "has": {"kind": "return_statement", "nth-child": {"at-least": 2}}}', language='javascript'`
- Find nested if statements: `rule='{"kind": "if_statement", "inside": {"kind": "if_statement"}}', language='javascript'`