# ast-grep Refactoring Examples

Practical patterns for common refactoring tasks.

## Remove Re-exports (Barrel Files)

Find all re-exports in a file:

```bash
# Wildcard re-exports
ast-grep run -l ts --pattern 'export * from "$Y"' ./

# Named re-exports
ast-grep run -l ts --pattern 'export { $$$X } from "$Y"' ./

# Type re-exports
ast-grep run -l ts --pattern 'export type * from "$Y"' ./
ast-grep run -l ts --pattern 'export type { $$$X } from "$Y"' ./
```

## Find Unused Imports

Find imports and their usage:

```bash
# Find all imports from a module
ast-grep run -l ts --pattern 'import { $$$X } from "$MOD"' ./

# Find usage of a specific import
ast-grep run -l ts --pattern '$IMPORTED' ./
```

Then manually check if `$IMPORTED` is used elsewhere in the file.

## Migrate Function Calls

Replace deprecated API calls:

```bash
# Find old pattern
ast-grep run -l ts --pattern 'oldApi.$METHOD($$$ARGS)' ./

# Replace with new pattern (using --rewrite)
ast-grep run -l ts --pattern 'oldApi.$METHOD($$$ARGS)' \
  --rewrite 'newApi.$METHOD($$$ARGS)' \
  -U ./
```

## Detect Anti-Patterns

### await in Promise.all

```bash
# Find await inside Promise.all (defeats parallelism)
ast-grep run -l ts --pattern 'await $X' ./
```

Then manually verify if inside `Promise.all([...])`.

### Console in Production

```bash
# Find all console calls
ast-grep run -l ts --pattern 'console.$METHOD($$$)' ./
```

## Find All Usages of a Symbol

```bash
# Find all usages of a function/type
ast-grep run -l ts --pattern '$SYMBOL' ./

# More specific: find calls to a function
ast-grep run -l ts --pattern '$FUNC($$$)' ./
```

## Extract Import Metadata

Find all imports with their sources:

```bash
# Named imports
ast-grep run -l ts --pattern 'import { $$$NAMED } from "$SOURCE"' ./

# Default imports
ast-grep run -l ts --pattern 'import $DEFAULT from "$SOURCE"' ./

# Namespace imports
ast-grep run -l ts --pattern 'import * as $NS from "$SOURCE"' ./

# Side-effect imports
ast-grep run -l ts --pattern 'import "$SOURCE"' ./
```

## Find Dynamic Imports

```bash
# require() calls
ast-grep run -l ts --pattern 'require("$SOURCE")' ./

# import() calls
ast-grep run -l ts --pattern 'import("$SOURCE")' ./

# await import()
ast-grep run -l ts --pattern 'await import("$SOURCE")' ./
```

## Debug and Inspect

### See AST structure

```bash
echo 'console.log("test")' | ast-grep run -l ts --stdin \
  --debug-query=ast --pattern '{}'
```

Output:

```
program (0,0)-(0,18)
  expression_statement (0,0)-(0,18)
    call_expression (0,0)-(0,17)
      ...
```

## Performance Tips

- Use `kind` rules first for fast filtering, then `pattern` for precision
- `all` rules must match same node (not multiple nodes)
- `any` rules match if any sub-rule matches
- Use `stopBy: end` carefully — searches entire ancestor chain

## Common Mistakes

1. **Pattern not parseable**: `from $X` fails — must be valid code like `import $X from "$Y"`
2. **Wrong case in meta-variables**: `$var` doesn't work — must be `$VAR` (uppercase)
3. **Confusing all/any**: `all` matches one node with all rules, not multiple nodes
4. **Missing quotes in patterns**: `export * from $Y` fails — use `export * from "$Y"`
5. **Regex not matching full text**: Regex must match entire node text, use `^` and `$`

## Validation

Always test patterns on a small file first:

```bash
# Test on single file
ast-grep run -l ts --pattern '$PATTERN' single-file.ts

# Verify with debug output
ast-grep run -l ts --pattern '$PATTERN' ./ --debug-query=ast


```
