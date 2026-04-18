---
name: gritql
description: Searches and rewrites codebases using GritQL declarative queries. Use when refactoring across languages, migrating dependencies, enforcing code patterns, or applying complex AST-level transformations at scale.
---

GritQL (`grit`) searches and rewrites source code using a declarative query language backed by tree-sitter. Patterns use backtick-enclosed code with `$VAR` metavariables — no AST vocabulary required. Install once: `curl -fsSL https://docs.grit.io/install | bash`.

## Core Workflow

### Quick search (find all matches, dry-run)

```bash
# Inline pattern in backticks
grit apply '`console.log($_)`' ./src/
```

### Search and rewrite (in-place modification)

```bash
# Use => for rewrites; . deletes the match
grit apply '`console.log($msg)` => `winston.log($msg)`' ./src/
grit apply '`console.log($_)` => .' ./src/   # delete matches
```

### Dry-run first, then apply

`grit apply` modifies files in place. For a preview, add `--dry-run`:

```bash
grit apply --dry-run '`require($X).$Y` => `import { $Y } from $X`' ./src/
```

### Language targeting

Use `-l` to limit languages (like ast-grep):

```bash
grit apply -l ts '`console.log($_)`' ./
grit apply -l py 'def $_($$$args) -> $_:' ./
```

## Writing Patterns

Patterns follow this structure: `` `source` => `target` where { constraints } ``

Metavariables capture AST nodes for reuse in rewrites or constraints:

- `$X` — captures a single node (uppercase letters only)
- `$_` — non-capturing wildcard (same name can match different content)

### Simple rewrite

```bash
# Rename a method across the codebase
grit apply -l ts '`$obj.oldMethod()` => `$obj.newMethod()`' ./src/
```

### Conditional rewrite with `where`

```bash
# Only transform console.log outside of tests
grit apply '`console.log($msg)` => `winston.log($msg)`' ./ \
  --where '$msg <: not within `describe($_, $_)`, `it($_, $_)`'
```

### Delete matches

```bash
grit apply '`debugger;' => .' ./src/
```

## Using Patterns from the Standard Library

The stdlib has 200+ patterns organized by language. Download and run them:

```bash
# Clone the stdlib once
git clone https://github.com/biomejs/gritql-stdlib.git /tmp/gritql-stdlib

# Run a specific pattern (file path = pattern name)
grit apply -p /tmp/gritql-stdlib/.grit/patterns/js/es6_arrow_functions.md ./src/

# Run multiple patterns from a directory
grit apply -p /tmp/gritql-stdlib/.grit/patterns/js/ ./src/
```

Key stdlib patterns by category:
| Category | Patterns | Example file |
|----------|----------|--------------|
| ES6 migrations | arrow functions, imports/exports | `es6_arrow_functions.md`, `es6_imports.md` |
| Framework migrations | React, Jest→Vitest, Cypress→Playwright | `jest_to_vitest.md`, `cypress_to_playwright.md` |
| Security fixes | unsafe negation, hash functions | `no_unsafe_negation.md`, `insecure_hash_function.md` |
| Anti-patterns | commented code, dead code | `no_commented_out_code.md`, `no_dead_code.md` |
| Style enforcement | curly braces, no alert | `curly.md`, `no_alert.md` |

## Saving Patterns for Reuse

Write patterns to a `.grit/` directory in your project:

```bash
mkdir -p .grit/patterns
```

Create a pattern file (`.md` or `.grit` extension):

```grit
engine marzano(0.1)
language js

`console.log($msg)` => `winston.log($msg)` where {
  $msg <: not within `describe($_, $_)`, `it($_, $_)`, `test($_, $_)`
}
```

Then run:

```bash
grit apply use_winston ./src/    # by pattern name
grit check                       # enforce as CI lint
```

## Advanced Features

See [references/language-reference.md](references/language-reference.md) for:

- `sequential` blocks for multi-step transformations
- `pattern` and `function` definitions for reusable logic
- Side conditions (`where`, `and`, `or`, `not`)
- Embedded JavaScript via `js` keyword
- File-level hooks (`before_each_file`, `after_each_file`)
- All supported languages: JS/TS, Python, Rust, Go, Java, JSON, YAML, Terraform, SQL, Solidity, CSS, Markdown

## Tips

- Use the [GritQL Playground](https://app.grit.io/studio) to experiment interactively
- Patterns must be valid code in backticks — `import { $X }` works, bare `$X` does not
- Verify with `--dry-run` before committing changes
- Run `grit --help` for all CLI options
