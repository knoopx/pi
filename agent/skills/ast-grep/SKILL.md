---
name: ast-grep
description: Searches code by AST patterns and performs structural refactoring across files. Use when finding function calls, replacing code patterns, or refactoring syntax that regex cannot reliably match.
---

# ast-grep

Structural code search and rewriting using AST matching.

## Quick Start

### Pattern Syntax

ast-grep uses pattern placeholders to match and capture AST nodes:

| Pattern  | Description                                                 |
| -------- | ----------------------------------------------------------- |
| `$VAR`   | Match a single AST node and capture it as `VAR`             |
| `$$$VAR` | Match zero or more AST nodes (spread) and capture as `VAR`  |
| `$_`     | Anonymous placeholder (matches any single node, no capture) |
| `$$$_`   | Anonymous spread placeholder (matches any number of nodes)  |

**Shell quoting tip:** Escape `$` as `\$VAR` or wrap the pattern in single quotes to avoid shell expansion.

### Supported Languages

javascript, typescript, tsx, html, css, python, go, rust, java, c, cpp, csharp, ruby, php, yaml

### Commands

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `ast-grep run`  | One-time search or rewrite (default) |
| `ast-grep scan` | Scan and rewrite by configuration    |
| `ast-grep test` | Test ast-grep rules                  |
| `ast-grep new`  | Create new project or rules          |
| `ast-grep lsp`  | Start language server                |

## Basic Search

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

## Search and Replace (Dry Run)

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

## Apply Changes

Apply refactoring to files:

```bash
# Apply changes (use --update-all)
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang javascript --update-all .
```

## Project Setup

```bash
# Initialize a new ast-grep project
ast-grep new my-refactor-rules

# Add rules to your project
cat > rules/my-rule.yaml << 'EOF'
patterns:
  - pattern: 'console.log($$$ARGS)'
    rewrite: 'logger.info($$$ARGS)'
    languages: [javascript, typescript]
EOF

# Run your custom rules
ast-grep scan --project my-refactor-rules
```

## Related Tools

- **codemapper**: Alternative pattern-based refactoring tool
- **typescript**: Type-safe AST manipulation
- **python**: AST parsing and manipulation
