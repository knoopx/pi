# Advanced Patterns

## Sequential Patterns

Apply multiple transformations in order. Only valid at the top level:

```grit
language js

sequential {
    contains `console.log($msg)` => `console.warn($msg)`,
    contains `console.warn($msg)` => `console.info($msg)`
}
// First pass: log→warn, second pass: warn→info. Result: both become info.
```

Steps run left to right; later steps see results of earlier ones. Each step is NOT auto-wrapped — include `contains` or `bubble` as needed. Use `maybe contains` for optional steps that never fail:

```grit
sequential {
    maybe contains `console.log($_)` => `console.warn($_)`,
    maybe contains `console.error($_)` => `console.warn($_)`
}
```

## Multifile Patterns

Match across multiple files with shared global state. Each step evaluates against ALL files:

```grit
language js

multifile {
  // Step 1: find and rename Props in one file
  bubble($prop, $source_file, $new_prop) file($body) where {
    $body <: contains `type $prop = $_` where {
      $source_file <: undefined,       // only first match
      $prop <: `Props`,
      $new_prop = `New$prop`,
      $prop => $new_prop,              // rename in source file
      $source_file = $filename          // remember which file
    }
  },
  // Step 2: rename usages in all other files
  bubble($prop, $source_file, $new_prop) file($body) where {
    $body <: contains `$prop` where {
      $prop <: imported_from(from = includes $source_file),
    },
    $body <: contains `$prop` => $new_prop
  }
}
```

Top level of each step must be a `file()` pattern, optionally preceded by `bubble`. For simple new file creation, prefer `$new_files` — it's faster on large codebases.

## Creating New Files

Append to `$new_files`:

```grit
`function $funcName($_) {$_}` as $f where {
  $funcName <: r"test.*",     // only test functions
  $f => .,                    // remove from original file
  $new_file_name = `$funcName.test.js`,
  $new_files += file(name = $new_file_name, body = $f)
}
```

**Warning:** `$new_files` does not check for existing files — you can overwrite.

### Using `$filename` for derived names

```grit
$filename <: r"(.*)\.js$"($base_name),
$new_file_name = `$base_name.test.js`,
$new_files += file(name = $new_file_name, body = $f)
```

## Range Patterns

Target code by position within a file:

```grit
// Delete first 3 lines of every file
range(start_line=1, end_line=3) => .

// Target specific lines of matched nodes
`console.log($_)` as $log where {
  $log <: contains or {
    range(start_line=2, end_line=2),
    range(start_line=5, end_line=6)
  }
} => .
```

Parameters: `start_line`, `end_line` (optional, defaults to EOF), `start_column`, `end_column`. Any AST node "contains" a range if it overlaps.

## Pattern Definitions (Named Patterns)

Reusable named patterns defined at the top level:

```grit
pattern import_statement($imports, $source) {
    import_statement(
        import = import_clause(name = named_imports($imports)),
        $source
    )
}

pattern task_with_callable($old_task_name, $task_func_name) {
    `$old_task_name = $_($args)` where {
        $old_task_name <: identifier(),
        $args <: contains keyword_argument(
            name = `python_callable`,
            value = $task_func_name
        )
    }
}
```

Mark as `private pattern` to hide from `grit list`:

```grit
private pattern internal_helper() {
    `console.log`
}
```

## Predicate Definitions

Boolean-returning patterns used in `where` clauses:

```grit
predicate is_imported_from($name, $source) {
    $name <: imported_from(source = $source)
}

predicate program_has_logger() {
    $program <: contains `logger`
}

// Usage
`console.log` => `logger.info` where {
    program_has_logger()
}
```

## File-Level Hooks

Run code before or after processing each file:

```grit
// Runs before each file
pattern before_each_file_prep() {
    $_ where { $GLOBAL_VARS = [], $GLOBAL_NAMES = [] }
}

// Runs after each file
pattern after_each_file_handle() {
    file($body) where { $body <: maybe some_pattern() }
}
```

Common use: collect imports across files and consolidate them.

## Pattern File Formats

### `.grit` file (raw patterns)

```grit
engine marzano(0.1)
language js

pattern my_rule() {
    `console.log($msg)` => `winston.log($msg)`
}
```

### `.md` file (with documentation and tests)

````markdown
---
title: Convert console.log to winston
tags: [js, logging]
level: error
---

# Convert console.log to winston

Description of what this pattern does.

```grit
engine marzano(0.1)
language js

`console.log($msg)` => `winston.log($msg)`
```
````

## Matches this input

```js
console.log("hello");
```

## Produces this output

```js
winston.log("hello");
```

````

File name becomes pattern name (minus `.md`). Frontmatter supports `level` and `tags`. Subheadings define test cases — single code block = must match, two blocks = input/output pair, identical blocks = negative test.

## Engine Version

Always declare at the top of pattern files:

```grit
engine marzano(0.1)   // or 1.0 for newer features
language js
````

Version 1.0 adds improved pattern matching and new predicates. Check GritQL docs for version differences.

## Language Declaration

```grit
language js
// Default is JavaScript if omitted, but always specify explicitly
```

Language variants: `language js(typescript,jsx)`, `language python`, etc. See [references/patterns-fundamentals.md](patterns-fundamentals.md) for the full list of supported languages and CLI flags.
