# ast-grep Reference

Detailed examples, advanced patterns, and codebase exploration.

## Advanced Scan with Rules

Use configuration files for complex refactoring scenarios:

```yaml
# rules/my-rules.yaml
patterns:
  # Convert console.log to logger.info
  - pattern: "console.log($$$_)"
    rewrite: "logger.info($$$_)"
    languages: [javascript, typescript]
    message: "Use logger instead of console.log"

  # Remove unused imports
  - pattern: 'import { $$$IMPORTS } from "$MODULE"'
    rewrite: 'import { $$$IMPORTS } from "$MODULE"' # Empty rewrite removes imports
    languages: [typescript]
    message: "Remove unused imports"

  # Add error handling
  - pattern: "function $NAME($$$ARGS) { $$$BODY }"
    rewrite: "async function $NAME($$$ARGS) { try { $$$BODY } catch (error) { throw error } }"
    languages: [javascript, typescript]
    message: "Add error handling"

# Global options
languages: [typescript, javascript]
update-all: true
```

### Running Custom Rules

```bash
# Run custom rules
ast-grep scan --project my-rules

# Run with verbose output
ast-grep scan --project my-rules --verbose

# Run with dry-run preview
ast-grep scan --project my-rules --dry-run

# Run specific rule
ast-grep run --pattern 'console.log($$$_)' --rewrite 'logger.info($$$_)' --lang typescript .
```

## Codebase Exploration

### Find All Function Calls

```bash
# Find all function calls
ast-grep run --pattern '$FUNCTION($$$_)' --lang typescript .

# Find specific function calls
ast-grep run --pattern 'fetch($$$_)' --lang typescript .
ast-grep run --pattern 'axios.get($$$_)' --lang typescript .
ast-grep run --pattern 'fs.readFile($$$_)' --lang typescript .
```

### Find API Patterns

```bash
# Find API routes
ast-grep run --pattern 'app.(get|post|put|delete)(\$$ARGS)' --lang javascript .

# Find React useEffect hooks
ast-grep run --pattern 'useEffect($$$_)' --lang tsx .

# Find React useState hooks
ast-grep run --pattern 'const [$STATE, $SETTER] = useState($INIT)' --lang tsx .

# Find React useCallback
ast-grep run --pattern 'useCallback($$$_)' --lang tsx .
```

### Find Error Handling Patterns

```bash
# Find try-catch blocks
ast-grep run --pattern 'try { $$$BODY } catch ($$$_)' --lang typescript .

# Find if-error checks
ast-grep run --pattern 'if ($$$_) { $$$BODY }' --lang javascript .

# Find Promise error handling
ast-grep run --pattern '.catch($$$_)' --lang typescript .
```

## Common Refactoring Examples

### Convert Function Declarations to Arrow Functions

```bash
# Preview
ast-grep run --pattern 'function $NAME($$$_) { $$$BODY }' \
  --rewrite 'const $NAME = ($$$_) => { $$$BODY }' --lang typescript .

# Apply
ast-grep run --pattern 'function $NAME($$$_) { $$$BODY }' \
  --rewrite 'const $NAME = ($$$_) => { $$$BODY }' --lang typescript --update-all .
```

### Replace Equality Operators

```bash
# Replace == with ===
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang typescript .

# Replace != with !==
ast-grep run --pattern '$A != $B' --rewrite '$A !== $B' --lang typescript .

# Replace === with ==
ast-grep run --pattern '$A === $B' --rewrite '$A == $B' --lang typescript .
```

### Add Optional Chaining

```bash
# Add optional chaining for safe property access
ast-grep run --pattern '$OBJ && $OBJ.$PROP' --rewrite '$OBJ?.$PROP' --lang typescript .

# Add optional chaining for array methods
ast-grep run --pattern '$ARR && $ARR.$METHOD($$$_)' --rewrite '$ARR?.$METHOD($$$_)' --lang typescript .
```

### Rename Variables

```bash
# Rename variable
ast-grep run --pattern 'const $OLD = $VALUE' --rewrite 'const $NEW = $VALUE' --lang typescript .

# Rename function parameter
ast-grep run --pattern 'function $NAME($$$_)' --rewrite 'function $NAME($$$_)' --lang typescript .
```

### Add Type Annotations

```bash
# Add function return type
ast-grep run --pattern 'function $NAME($$$_) { $$$BODY }' --rewrite 'function $NAME($$$_): ReturnType<$NAME> { $$$BODY }' --lang typescript .

# Add const assertion
ast-grep run --pattern 'const $NAME = $VALUE' --rewrite 'const $Name: const = $VALUE' --lang typescript .
```

### Extract Functions

```bash
# Extract repeated code to a function
ast-grep run --pattern 'if (condition) { $$$BODY } else { $$$BODY }' \
  --rewrite 'function $NAME($$$_) { if (condition) { $$$BODY } else { $$$BODY } }' --lang typescript .
```

### Add JSDoc Comments

```bash
# Add JSDoc to functions
ast-grep run --pattern 'function $NAME($$$_) { $$$BODY }' \
  --rewrite '/** @param {$$$ARGS} @returns {ReturnType<$NAME>} */\nfunction $NAME($$$_) { $$$BODY }' --lang typescript .

# Add JSDoc to variables
ast-grep run --pattern 'const $NAME = $VALUE' --rewrite '/** @type {typeof $VALUE} */\nconst $NAME = $VALUE' --lang typescript .
```

### Add TypeScript Strict Checks

```bash
# Add strict equality checks
ast-grep run --pattern '$A == $B' --rewrite '$A === $B' --lang typescript .

# Add not-undefined checks
ast-grep run --pattern '$PROP && $PROP.$METHOD($$$_)' --rewrite '$PROP?.($METHOD($$$_))' --lang typescript .
```

### Python-Specific Refactoring

```bash
# Replace print with logging
ast-grep run --pattern 'print($$$_)' --rewrite 'logger.info($$$_)' --lang python .

# Add docstrings to functions
ast-grep run --pattern 'def $NAME($$$_): $$$BODY' \
  --rewrite 'def $NAME($$$_):\n    """$NAME($ARGS)"""\n    $$$BODY' --lang python .

# Add type hints
ast-grep run --pattern 'def $NAME($$$_): $$$BODY' \
  --rewrite 'def $NAME($$$_) -> None: $$$BODY' --lang python .
```

### JavaScript-Specific Refactoring

```bash
# Replace var with const/let
ast-grep run --pattern 'var $NAME = $VALUE' --rewrite 'const $NAME = $VALUE' --lang javascript .

# Convert to class methods
ast-grep run --pattern 'function $NAME($$$_) { $$$BODY }' \
  --rewrite 'class MyClass {\n  $NAME($$$_) { $$$BODY }\n}' --lang javascript .

# Add event listeners
ast-grep run --pattern '$ELEMENT.addEventListener($EVENT, $FUNCTION)' \
  --rewrite '$ELEMENT.on($EVENT) = $FUNCTION' --lang javascript .
```

## Tips

- Use `--dry-run` to preview changes before applying
- Use `--update-all` to apply to all matching files
- Use `--lang` to specify the language for pattern matching
- Use single quotes for patterns with `$` variables to avoid shell expansion
- Escape `$` as `\$VAR` when using double quotes
- Combine with `--verbose` to see detailed matching information
- Use `--test` to validate pattern correctness
