# Patterns Fundamentals

## Code Snippets

Any valid code snippet in backticks is a pattern. Grit performs structural matching via tree-sitter — whitespace and formatting variations are handled automatically.

```grit
// Match exact call
`console.log("Hello, world!")`

// Match with metavariables
`console.log($message)`

// Alternative: language-prefixed strings (limits to specific language)
js"console.log('Hello, world!')"
```

Escape `$` and `` ` `` with backslash when needed: `` `console.log(\`$template\`)` ``. Use `raw` prefix to bypass Grit's validation for raw output:

```grit
`console.log($message)` => raw`if(' // always outputs as-is`
```

## Metavariables

Metavariables bind parts of the syntax tree for reuse in rewrites or constraints. Must match regex `$[a-zA-Z_][a-zA-Z0-9_]*`.

| Syntax | Meaning                                              | Example                                                       |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------- |
| `$X`   | Captures a single node, bound to name X              | `` `console.log($msg)` `` — binds the argument                |
| `$_`   | Non-capturing wildcard (can match different content) | `` `console.log($_)` `` — matches any call regardless of args |
| `$...` | Spread metavariable — matches 0 or more nodes        | `` `console.log($first, $...)` ``                             |

Metavariables default to file-level scope but are typically restricted by pattern auto-wrapping. Use `bubble` (see [references/scoping-bubble.md](scoping-bubble.md)) to control scoping.

Reserved: `$filename`, `$new_files`, `$program`, and anything starting with `$grit_`.

### Explicit assignment

```grit
`const $logger = logger.$action($message)` where {
  $special_logger = js"$[action]Logger",
  $logger => $special_logger
}
```

Wrap metavariable names in braces inside snippets to distinguish from literal text: `$[name]Class`.

## Rewrites

Use `=>` to transform matched code. The right-hand side is a pattern or metavariable reference.

```grit
// Simple replacement
`console.log($msg)` => `console.warn($msg)`

// Delete by rewriting to dot
$matched_node => .

// Rewrite inside where clause (applies when condition matches)
`$test($_)` where { $test <: js"test.only" => js"test" }
```

Rewrites are patterns themselves — they can appear anywhere a pattern is used, including in conditions.

### Specific rewrites (recommended)

Preserve surrounding code by matching large and rewriting only specific metavariables:

```grit
// Bad — loses async keyword and comments
`function foo($args) { $body }` => `function bar($args) { $body }`

// Good — preserves async and comments
`function $name($args) { $body }` where {
  $name <: `foo` => `bar`
}
```

## AST Nodes

AST nodes represent syntax tree elements. Match directly against the tree structure — see the debug panel in [GritQL Studio](https://app.grit.io/studio) to inspect trees.

```grit
// Match any augmented assignment regardless of operator
augmented_assignment_expression(operator = $op, left = $x, right = $v)

// Omit fields you don't care about (defaults to $_)
augmented_assignment_expression(operator = $op)
```

## Primitives

### Strings

Language-agnostic strings in double quotes. Match exact text rather than AST structure:

```grit
"Hello, world!" <: r"^Hello.*"  // regex match against string
```

Useful for formatting transformations that code snippets can't express.

### Numbers

Two types (`int`, `double`) — inferred from context:

```grit
js"multiply($x)" where {
  $y = $x * 2,
  $x => $y
}
```

### Lists

Constructed with `[]`, indexed with `$list[index]` (negative indices count from end):

```grit
$list = [`1`, `2`, `3`]
$list[0]    // "1"
$list[-1]   // "3"
```

Two uses: accumulation (`+=`) and matching ordered AST node sequences:

```grit
// Accumulation
$new_numbers = [],
$new_numbers += 3,
$new_numbers += 4,

// Match specific sequence
$statements <: [function_declaration(), return_statement()]
```

### Maps

Immutable maps with dot-notation access (`$map.key`):

```grit
$capitals = { england: `london`, ours: $val }
$capitals.ours <: `paris`   // true if $val matches "paris"
```

## Regular Expressions

Prefix with `r` for regex. Capture groups bind metavariables:

```grit
"Hello, world!" <: r"Hello, (.*)"($name)  // $name = "world"

// Dynamic regex from snippet
$message <: r`([a-zA-Z]*), Lucy`($greeting)
```

Uses Rust regex syntax. Match against the full variable or node value — use wildcards for partial matches.

## File and Program Context

```grit
// Match entire file body
file($name, $body) where {
  $name => `$name.bak`,
  $body => `// renamed\n\n$body`
}

// Check if program contains something (always available)
`console.log($log)` => `logger.log($log)` where {
  $program <: contains `logger`
}
```

## Range Patterns

Target code by line/column position:

```grit
range(start_line=1, end_line=3) => .   // delete first 3 lines

// Target specific lines of matched nodes
$matched <: contains or {
  range(start_line=2, end_line=2),
  range(start_line=5, end_line=6)
}
```

## Empty Pattern

`.` on the right-hand side only — deletes the matched node:

```grit
`console.log($_)` => .
```
