# Pattern Modifiers

Modifiers transform how patterns are matched. They modify or combine other patterns — none is a complete pattern by itself.

## `contains` Operator

Traverses downward through the syntax tree. The outer pattern matches any node that contains the inner pattern:

```grit
// Match functions where one argument is "x"
`function ($args) { $body }` where {
  $args <: contains `x`
}
```

### `until` Modifier

Stop traversal at matching nodes within a `contains` clause:

```grit
`console.$_($content)` where {
  $content <: contains `secret` until `sanitized($_)`
}
// Matches console.log(secret) but not console.log(sanitized(secret))
```

## `as` Modifier

Assigns a matched snippet to a metavariable. Enables both granular and wholesale changes:

```grit
`function $name ($args) { $body }` as $func where {
  // Rewrite the whole function
  $func => `const $name = ($args) => { $body }`,
  // But also do granular change on arguments
  $args <: contains `apple` => `mango`
}
```

## `within` Clause (as modifier)

Restricts matching to nodes inside a specific parent pattern:

```grit
`console.log($arg)` where {
  $arg <: within `if (DEBUG) { $_ }`
}
```

## `some` Clause

Matches if at least one element of a list matches the pattern:

```grit
`var $x = [$names]` => `var coolPeople = [$names]` where {
  $names <: some { `"andrew"` }
}
// Only changes arrays containing "andrew"
```

Use `maybe some` to allow no matches without failure.

## `every` Clause

Matches only if every element of a list matches the pattern (short-circuited):

```grit
`var $x = [$names]` => `var coolPeople = [$names]` where {
  $names <: every or { `"andrew"`, `"alex"` }
}
// Only changes arrays where ALL elements are either "andrew" or "alex"
```

## List Patterns

Match ordered sequences of AST nodes:

```grit
$numbers <: [ `2`, `3`, `5` ]      // exact sequence
$numbers <: [ `2`, `3`, ..., `11` ] // with ignored middle elements
```

## `not` Clause

Negates a pattern:

```grit
`$method($msg)` => `console.warn($msg)` where {
  $method <: not `console.error`
}
// Rewrites all console.* except console.error
```

## `any` Clause

Like `or` but non-short-circuiting — tries all patterns and applies all applicable transformations:

```grit
arrow_function($body) where $body <: any {
  contains js"React.useState" => js"useState",
  contains js"React.useMemo" => js"useMemo",
}
// Both transformations apply if both match
```

## `maybe` Clause

Optional match — never fails even if the inner pattern doesn't match:

```grit
`throw new Error($err)` as $thrown => `throw new CustomError($err);` where {
  $err <: maybe string(fragment=$msg) => `{ message: $err }`
}
// If $err is already a string, wraps it. Otherwise leaves it unchanged.
```

Metavariables bound inside `maybe` are undefined if the clause doesn't match — don't use them outside.

## `and` / `or` Clauses (as modifiers)

Combine patterns for matching:

```grit
// and — all must match
$body <: and {
  contains js"React.useState" => js"useState",
  contains js"React.useMemo" => js"useMemo",
}

// or — any can match (short-circuited)
$body <: or {
  contains `console.log`,
  contains `console.error`
}
```

## `limit` Clause

Limit the number of files a pattern affects:

```grit
`console.$method($msg)` => `console.warn($msg)` limit 5
// Only affects 5 files total, applied globally across all query targets
```

Must be at the root level. Not auto-wrapped — place carefully with `sequential` or `multifile`.

## Pattern Auto-Wrapping

Unless targeting `file` or `body`, patterns are automatically wrapped:

```grit
file(body = contains bubble $YOUR_PATTERN)
```

This enables multiple matches per file. To override and require a single binding per metavariable across all matches, explicitly wrap in `file`:

```grit
// $method consistently binds to "info" for ALL console.info calls
file(body = contains `console.$method` => `println`)
```

See [references/scoping-bubble.md](scoping-bubble.md) for full scoping details.
