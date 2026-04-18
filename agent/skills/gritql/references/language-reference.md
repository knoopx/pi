# GritQL Language Reference

Complete reference for writing GritQL patterns. Patterns are evaluated by the `grit` CLI against source code parsed into an AST via tree-sitter.

## Pattern Structure

A pattern consists of a match expression, optional rewrite, and optional constraints:

```
`source_pattern` => `target_rewrite` where { side_conditions }
```

The `=> target` part is optional (match-only mode). The `where {}` clause is optional.

### Metavariables

Metavariables capture AST nodes for reuse in rewrites or constraints:

| Syntax | Meaning                                                             | Example                                                     |
| ------ | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `$X`   | Captures a single node, bound to name X                             | `$msg` captures the argument of `console.log($msg)`         |
| `$_`   | Non-capturing wildcard (can match different content with same name) | `` `console.log($_)` `` matches any call regardless of args |
| `$$$X` | Captures zero or more nodes                                         | `` `$param, $$$rest` `` captures a parameter list           |
| `$_X`  | Non-capturing with binding                                          | Same as `$_`, but `$X` can match different values           |

Metavariable names must be uppercase letters. Lowercase is invalid.

## Match Expressions

Any code snippet in backticks is a valid pattern. Tree-sitter parses it and matches against the target AST:

```bash
# Match function calls with specific arguments
grit apply '`console.log("hello")`' ./

# Match any call expression
grit apply '`$_($$$args)`' ./

# Match import statements
grit apply '`import { $$$X } from "$Y";`' ./

# Match object properties
grit apply '`$obj.$prop`' ./
```

Patterns can include metavariables and literal text:

```bash
# Capture the variable name and property access
grit apply '`const $name = $obj.$prop`' ./
```

## Rewrite Expressions

Use `=>` to transform matched code:

```bash
# Simple replacement
grit apply '`console.log($msg)` => `winston.log($msg)`' ./

# Delete matches by rewriting to . (dot)
grit apply '`debugger;' => .' ./

# Capture and reuse metavariables in target
grit apply '`$X.$oldMethod()` => `$X.$newMethod()`' ./

# Reorder captured nodes
grit apply '`$a === $b` where { $a <: binary_operator() } => `($b === $a)`' ./
```

### Object literal rewriting

When returning an object from a rewrite, wrap in parentheses:

```bash
# Arrow function returning an object needs parens
grit apply '(`($args) => { return $_ }`)' => '(`($args) => $_`)' ./
```

## Side Conditions (where clauses)

The `where {}` clause adds boolean logic and constraints using captured metavariables:

### Basic predicates

```bash
# Check type of captured node
grit apply '`$X` where { $X <: identifier() }' ./

# Match against literal values
grit apply '`console.log($msg)` where { $msg <: "production" }' ./

# Regular expression matching
grit apply '`$X` where { $X <: r"^[a-z]+$" }' ./
```

### Logical operators

```bash
# AND: all conditions must match
`$X` where { $X <: identifier(), $X <: not r"^_" }

# OR: any condition matches
`$X` where { $X <: or { `$_("test")`, `$_("mock")` } }

# NOT: negation
`$X` where { $X <: not within `describe($_, $_)` }
```

### Context predicates

```bash
# Check if match is inside a specific construct
`console.log($msg)` where { $msg <: not within `try { $_ } catch { $_ }` }

# Check containment in parent AST
$program <: contains `$X = new TargetClass($_)`

# Check position (after/before sibling nodes)
$current <: after $previous_block
```

### Bubble pattern

The `bubble` helper traverses upward through the AST, collecting matches:

```bash
# Collect all identifiers matching a pattern going up from current node
$bubbles = [],
$target <: some bubble($bubbles, $match) $identifier where { $identifier <: or { `$_("test")`, `$_("mock")` } }
```

### Sequential evaluation

Use `sequential {}` for multi-step transformations that must run in order:

```grit
engine marzano(0.1)
language js

sequential {
    contains or {
        pattern_one(),
        pattern_two()
    },
    maybe contains pattern_three()  # optional, only runs if matches exist
}
```

- `contains` — requires at least one match (fails if no matches)
- `maybe contains` — optional match (never fails)
- Patterns run left to right; later patterns see results of earlier ones

## Defining Reusable Patterns and Functions

### Pattern definitions

Named patterns are defined with `pattern name($args) { body }`:

```grit
pattern import_statement($imports, $source) {
    import_statement(import=import_clause(name=named_imports($imports)), $source)
}

pattern task_with_callable($old_task_name, $task_func_name) {
    `$old_task_name = $_($args)` where {
        $old_task_name <: identifier(),
        $args <: contains keyword_argument(name=`python_callable`, value=$task_func_name)
    }
}
```

### Function definitions

Functions can be defined in GritQL or embedded JavaScript:

```grit
// GritQL function (uses GritQL predicates internally)
function group_blocks($target) {
    $blocks = [],
    $target <: some bubble($blocks, $block, $block_tail) $current where {
        if ($block <: undefined) {
            $block = [$current],
            $block_tail = $current
        } else {
            if ($current <: after $block_tail) {
                $block += $current,
                $block_tail = $current
            } else {
                $blocks += $block,
                $block = [$current],
                $block_tail = $current
            }
        }
    },
    if (not $block <: undefined) { $blocks += $block },
    return $blocks
}

// Embedded JavaScript for string operations
function replace_all($haystack, $search, $replacement) js {
  const replacement = $haystack.text.replaceAll($search.text, $replacement.text);
  return replacement;
}
```

### Predicate definitions

Predicates are like functions but always return boolean:

```grit
predicate is_imported_from($name, $source) {
    $name <: imported_from(source=$source)
}

predicate ensure_import($name, $source) {
    if ($name <: not imported_from(from=$source)) {
        // add import logic here
        true
    } else { true }
}
```

## File-Level Hooks

Patterns can hook into file processing for cross-file operations:

```grit
// Runs before each file is processed
pattern before_each_file_prep() {
    $_ where { $GLOBAL_VARS = [], $GLOBAL_NAMES = [] }
}

// Runs after each file is processed
pattern after_each_file_handle() {
    file($body) where { $body <: maybe some_pattern() }
}
```

Common use: collect imports across files and insert consolidated imports.

## Engine Version

Always declare the engine version at the top of pattern files:

```grit
engine marzano(0.1)   // or 1.0 for newer features
language js            // target language
```

Version 1.0 adds additional features like improved pattern matching and new predicates. Check the [GritQL docs](https://docs.grit.io/language) for version differences.

## Supported Languages

| Language              | CLI flag           | Pattern file tag     |
| --------------------- | ------------------ | -------------------- |
| JavaScript/TypeScript | `-l js` or `-l ts` | `language js`        |
| Python                | `-l py`            | `language python`    |
| Rust                  | `-l rs`            | `language rust`      |
| Go                    | `-l go`            | `language go`        |
| Java                  | `-l java`          | `language java`      |
| JSON                  | `-l json`          | `language json`      |
| YAML                  | `-l yaml`          | `language yaml`      |
| Terraform             | `-l tf`            | `language terraform` |
| SQL                   | `-l sql`           | `language sql`       |
| Solidity              | `-l sol`           | `language solidity`  |
| CSS                   | `-l css`           | `language css`       |
| Markdown              | `-l md`            | `language markdown`  |
| All languages         | (none)             | `language universal` |

## CLI Reference

```bash
# Search for matches (dry-run by default on inline patterns)
grit apply '`pattern`' [path...] [-l lang]

# Apply rewrites (modifies files in place)
grit apply '`match` => `target`' [path...]

# Dry-run preview of changes
grit apply --dry-run '`match` => `target`' [path...]

# Run patterns from the standard library
grit apply -p /path/to/stdlib/.grit/patterns/js/ ./src/

# Save patterns to project and run by name
mkdir -p .grit/patterns
echo 'pattern_name' > .grit/patterns/my_rule.md
grit apply my_rule ./src/

# Enforce patterns as lints (fails CI on violations)
grit check [path...]

# Exclude directories
grit apply '`console.log($_)`' ./ --exclude node_modules --exclude dist

# Verbose output
grit apply --verbose '`pattern`' ./
```

## Pattern File Formats

Patterns can be written in two formats:

### Markdown format (`.md`) — with documentation

```markdown
---
title: Convert console.log to winston
tags: [js, logging]
---

Description of what this pattern does.

\`\`\`grit
engine marzano(0.1)
language js

`console.log($msg)` => `winston.log($msg)`
\`\`\`

## Before

\`\`\`js
console.log("hello");
\`\`\`

## After

\`\`\`js
winston.log("hello");
\`\`\`
```

### Grit format (`.grit`) — raw patterns only

```grit
engine marzano(0.1)
language js

pattern my_pattern() {
    `console.log($msg)` => `winston.log($msg)`
}
```

## Common Patterns Reference

### Find and replace method calls

```bash
grit apply -l ts '`$obj.$oldMethod()` => `$obj.$newMethod()`' ./
```

### Convert require to import

```bash
grit apply -p gritql-stdlib/.grit/patterns/js/es6_imports.md ./
```

### Remove console.log calls

```bash
grit apply -l ts '`console.log($_)` => .' ./src/ --exclude '**/*.test.ts'
```

### Enforce arrow functions (no `function` keyword)

```bash
grit apply -p gritql-stdlib/.grit/patterns/js/es6_arrow_functions.md ./
```

### Fix security issues

```bash
# Python: replace insecure hashes
grit apply -p gritql-stdlib/.grit/patterns/python/insecure_hash_function.md ./

# JS: fix unsafe negation
grit apply -p gritql-stdlib/.grit/patterns/js/no_unsafe_negation.md ./
```

### Migrate test frameworks

```bash
# Jest to Vitest
grit apply -p gritql-stdlib/.grit/patterns/js/jest_to_vitest.md ./

# Cypress to Playwright
grit apply -p gritql-stdlib/.grit/patterns/js/cypress_to_playwright.md ./
```
