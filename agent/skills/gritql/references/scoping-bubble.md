# Scoping and the Bubble Clause

## Default Scope

All metavariables share a single file-level scope. Once bound, a metavariable retains that value throughout pattern evaluation. This means `console.log($x)` will only match the first occurrence of `$x` in a file — subsequent occurrences fail because `$x` is already bound.

```grit
// With default scoping, $msg binds to "Hello" on first match
// Second console.log fails because $msg would need to be "How are you"
console.log('Hello');  // matched: $msg = 'Hello'
console.log('How are you?');  // not matched (scope conflict)
```

## Pattern Auto-Wrap (Default Behavior)

By default, Grit auto-wraps non-file-targeting patterns:

```grit
file(body = contains bubble $YOUR_PATTERN)
```

The `bubble` inside auto-wrap isolates metavariable scopes, so patterns match multiple times per file. This is the recommended behavior for most use cases.

## `bubble` Clause

Creates a new isolated scope without defining a separate pattern. Metavariables inside are independent from outside:

```grit
`function() { $body }` where {
  $body <: contains bubble `console.log($msg)` => `console.warn($msg)`
}
// Both console.log calls are rewritten — $msg is scoped per occurrence
```

## Bubble Arguments

Arguments "pierce" the bubble boundary, allowing outer metavariables to retain their values inside:

```grit
`function $name() { $body }` where {
  $body <: contains bubble($name) `console.log($msg)` => `console.warn($msg, $name)`
}
// $name from the outer scope is available inside the bubble
```

Without `$name` as an argument, it would be undefined inside the bubble.

## Pattern Definitions and Scope

Pattern definitions create a new scope. Parameters bridge the boundary — they're available inside but local variables are not:

```grit
pattern console_method_to_info($method) {
  // $method is bound from the call; $message is local to this definition
  `console.$method($message)` => `console.info($message)`
}

// Call with named argument
console_method_to_info(method = `log`)
```

## Global Metavariables

Use `$GLOBAL_` prefix (uppercase) for variables that persist across pattern definitions and bubbles:

```grit
$GLOBAL_IMPORTS = [],  // accumulate imports across files/patterns
pattern add_import($name, $source) {
  $GLOBAL_IMPORTS += `import { $name } from $source;`,
  true
}
```

## `file` and `program` Patterns

### `file` — match entire file

```grit
engine marzano(0.1)
language js

file($name, $body) where {
  $name => `$name.bak`,           // rename the file
  $body => `// processed\n\n$body` // prepend to body
}
```

### `program` — always available

Always in scope regardless of pattern position:

```grit
`console.log($log)` => `logger.log($log)` where {
  $program <: contains `logger`  // only if logger is used elsewhere
}
```

## Reserved Metavariables

| Name         | Purpose                                        |
| ------------ | ---------------------------------------------- |
| `$program`   | The entire (current) program                   |
| `$filename`  | Current file path being processed              |
| `$new_files` | List for creating new files — append with `+=` |

Avoid: any metavariable starting with `$grit_`.
