---
name: ast-grep
description: Search code by AST patterns and perform structural refactoring across files. Use when finding function calls, replacing code patterns, or refactoring syntax that regex cannot reliably match.
---

# ast-grep

Structural code search and rewriting using AST matching instead of regex.

## Contents

- [Pattern Syntax](#pattern-syntax)
- [Basic Search](#basic-search)
- [Search and Replace](#search-and-replace-dry-run)
- [Advanced Scan with Rules](#advanced-scan-with-rules)
- [Common Refactoring Examples](#common-refactoring-examples)
- [Project Setup](#project-setup)

## Pattern Syntax

ast-grep uses pattern placeholders to match and capture AST nodes:

| Pattern | Description |
|---------|-------------|
| `$VAR` | Match a single AST node and capture it as `VAR` |
| `$$$VAR` | Match zero or more AST nodes (spread) and capture as `VAR` |
| `$_` | Anonymous placeholder (matches any single node, no capture) |
| `$$$_` | Anonymous spread placeholder (matches any number of nodes) |

**Shell quoting tip:** Escape `$` as `\$VAR` or wrap the pattern in single quotes to avoid shell expansion.

## Supported Languages

javascript, typescript, tsx, html, css, python, go, rust, java, c, cpp, csharp, ruby, php, yaml

## Commands

| Command | Description |
|---------|-------------|
| `ast-grep run` | One-time search or rewrite (default) |
| `ast-grep scan` | Scan and rewrite by configuration |
| `ast-grep test` | Test ast-grep rules |
| `ast-grep new` | Create new project or rules |
| `ast-grep lsp` | Start language server |

## Usage

### Basic Search

Find patterns in code:

```bash
# Find console.log calls
ast-grep run --pattern 'console.log($$$ARGS)' --lang javascript .

# Find React useState hooks
ast-grep run --pattern 'const [$STATE, $SETTER] = useState($INIT)' --lang tsx .

# Find async functions
ast-grep run --pattern 'async function $NAME($$$ARGS) { $$$BODY }' --lang typescript .

# Find Express route handlers
ast-grep run --pattern 'app.$METHOD($PATH, ($$$ARGS) => { $$$BODY })' --lang javascript .

# Find Python function definitions
ast-grep run --pattern 'def $NAME($$$ARGS): $$$BODY' --lang python .

# Find Go error handling
ast-grep run --pattern 'if $ERR != nil { $$$BODY }' --lang go .
```

### Search and Replace (Dry Run)

Preview refactoring changes without modifying files:

```bash
# Replace == with === (preview)
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang javascript .

# Convert function to arrow function (preview)
ast-grep run --pattern 'function $NAME($$$ARGS) { $$$BODY }' \
  --rewrite 'const $NAME = ($$$ARGS) => { $$$BODY }' --lang javascript .

# Replace var with let (preview)
ast-grep run --pattern 'var $NAME = $VALUE' --rewrite 'let $NAME = $VALUE' --lang javascript .

# Add optional chaining (preview)
ast-grep run --pattern '$OBJ && $OBJ.$PROP' --rewrite '$OBJ?.$PROP' --lang javascript .
```

### Apply Changes

Apply refactoring to files:

```bash
# Apply changes (use --update-all)
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang javascript --update-all .
```

### Advanced Scan with Rules

Use inline rules for complex pattern matching with logical operators:

```bash
# Find functions containing await
ast-grep scan --inline-rules '{"id": "async-fn", "language": "javascript", "rule": {"kind": "function_declaration", "has": {"pattern": "await $EXPR"}}}' .

# Find nested if statements
ast-grep scan --inline-rules '{"id": "nested-if", "language": "javascript", "rule": {"kind": "if_statement", "inside": {"kind": "if_statement"}}}' .

# Find console.log inside catch blocks
ast-grep scan --inline-rules '{"id": "catch-log", "language": "javascript", "rule": {"pattern": "console.log($$$ARGS)", "inside": {"kind": "catch_clause"}}}' .
```

### Rule Operators

Rules support these operators for complex matching:

- `all`: All conditions must match
- `any`: Any condition must match
- `not`: Negate a condition
- `inside`: Node must be inside another pattern
- `has`: Node must contain another pattern
- `kind`: Match AST node type
- `pattern`: Match a code pattern

## Common Refactoring Examples

### JavaScript/TypeScript

```bash
# Convert require to import
ast-grep run --pattern 'const $NAME = require($PATH)' \
  --rewrite 'import $NAME from $PATH' --lang javascript .

# Simplify boolean return
ast-grep run --pattern 'if ($COND) { return true } else { return false }' \
  --rewrite 'return !!$COND' --lang javascript .

# Convert Promise.then to async/await
ast-grep run --pattern '$PROMISE.then($CALLBACK)' \
  --rewrite 'await $PROMISE' --lang javascript .
```

### Python

```bash
# Convert string formatting
ast-grep run --pattern '"%s" % ($ARGS)' \
  --rewrite 'f"{$ARGS}"' --lang python .

# Find deprecated function calls
ast-grep run --pattern 'old_function($$$ARGS)' --lang python .
```

### React

```bash
# Find class components
ast-grep run --pattern 'class $NAME extends React.Component { $$$BODY }' --lang tsx .

# Find useEffect with empty deps
ast-grep run --pattern 'useEffect($CALLBACK, [])' --lang tsx .
```

## Workflow

1. **Search first**: Use `ast-grep run --pattern` to find matches
2. **Preview changes**: Add `--rewrite` to see what would change
3. **Verify output**: Review the diff output carefully
4. **Apply changes**: Add `--update-all` to modify files
5. **Test**: Run tests to verify refactoring didn't break anything

## Project Setup

Create a new ast-grep project with rules:

```bash
# Initialize project with sgconfig.yml
ast-grep new

# Create a new rule
ast-grep new rule

# Create a new test for rules
ast-grep new test
```

## Testing Rules

```bash
# Test all rules in project
ast-grep test

# Test with specific config
ast-grep test -c ./sgconfig.yml
```

## Language Server

```bash
# Start LSP for editor integration (use tmux for background)
tmux new -d -s ast-grep-lsp 'ast-grep lsp'
```

## Tips

- Start with simple patterns and refine
- Use `$_` for parts you don't care about capturing
- Use `$$$` for variable-length matches (arguments, statements)
- Test patterns on a single file first: `ast-grep run --pattern '...' --lang js path/to/file.js`
- Use JSON output for programmatic processing: `ast-grep run --pattern '...' --json`
- Use `ast-grep new` to scaffold rules and tests

## Related Skills

- **typescript**: Use ast-grep for TypeScript-specific refactoring patterns.
- **jscpd**: Combine with duplicate detection to find and consolidate similar code.
