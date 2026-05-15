# Conditions

## `where` Clause

The `where` clause adds constraints. All conditions inside must be true for the pattern to match:

```grit
// Single condition (comma-separated conditions are implicitly AND)
`console.log($msg)` => . where { $msg <: js"'production'" }

// Multiple conditions — all must be true
`$X` where { $X <: identifier(), $X <: not r"^_" }
```

## Match Operator (`<:`)

The most common condition. Matches a metavariable on the left against a pattern on the right:

```grit
// Match against a code snippet
`console.log('$msg')` where { $msg <: `Hello, world!` }

// Match against an AST node type
`console.log($msg)` where { $msg <: string() }

// Match against a literal value
`$X` where { $X <: "production" }

// Match against regex
`$X` where { $X <: r"^[a-z]+$" }
```

## Logical Operators

### `!` (negation)

Negates the entire condition. Equivalent to `$x <: not <pattern>`:

```grit
`console.log('$msg');` => `console.warn('$msg');` where {
  ! $msg <: "Hello, world!"
}
```

### `and`

All conditions must be true (often redundant with `where` since it already requires all):

```grit
`console.$method('$msg');` => `console.warn('$msg');` where {
  and {
    $msg <: r"Hello, .*!",
    $method <: `log`
  }
}
```

### `or`

At least one condition must be true:

```grit
`console.$method('$msg');` => `console.warn('$msg');` where {
  or {
    $msg <: "Hello, world!",
    $method <: `error`
  }
}
```

## `if` as a Condition

Conditional rewrite based on whether another condition matches:

```grit
`$method('$msg')` where {
  if ($msg <: r"Hello, .*!") {
    $method => `console.info`
  } else {
    $method => `console.warn`
  }
}
```

## Rewrite as Condition

Rewrite within a `where` clause applies the transformation and succeeds if all rewrite targets match:

```grit
`console.log('$msg')` where $msg => `Hello, world!`
```

The left-hand side must be a metavariable. The rewrite is applied to all matching locations.

## Assignment (`=`)

Assigns a value to a metavariable inside a `where` clause. Always succeeds:

```grit
`console.log($msg)` as $log where {
  $new_call = `logger.log($msg)`,
  $log => $new_call
}
```

Can assign code snippets, strings, lists, numbers, or any valid Grit pattern value. Use `+=` to append to lists/strings.

## Context Predicates

### `within` — parent match

Match only if the node appears inside code matching another pattern:

```grit
`console.log($arg)` where {
  $arg <: within `if (DEBUG) { $_ }`
}
// Only matches console.log inside the if block, not the one outside
```

### `after` — sibling after

Match only if directly after a node matching the pattern. Can also retrieve the following node:

```grit
`console.warn($_)` as $warn where {
  $warn <: after `console.log($_)`
}

// Retrieve next sibling
`const $x = 5` as $const where {
  $next = after $const
} += `// Next: $next`
```

### `before` — sibling before

Mirror of `after`:

```grit
`console.warn($_)` as $warn where {
  $warn <: before `console.log($_)`
}
```

## Program-Level Conditions

Access the entire program from anywhere in a pattern:

```grit
// Only rewrite if logger is used somewhere in this file
`console.log($log)` => `logger.log($log)` where {
  $program <: contains `logger`
}
```
