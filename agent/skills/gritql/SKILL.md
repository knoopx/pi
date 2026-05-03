---
name: gritql
description: Searches and rewrites codebases using GritQL declarative queries. Use when refactoring across languages, migrating dependencies, enforcing code patterns, or applying complex AST-level transformations at scale.
---

# gritql (`grit`)

Searches and rewrites source code using a declarative query language backed by tree-sitter. Any valid code snippet in backticks is a pattern — no AST vocabulary required. Install: `curl -fsSL https://docs.grit.io/install | bash` or `npm install --location=global @getgrit/cli`.

## Searching Code

Find matches structurally (whitespace-insensitive):

```bash
grit apply '`console.log($_)`' ./src/
```

Patterns match the AST structure — variations in formatting are handled automatically.

## Rewriting Code

Replace patterns in-place:

```bash
# Replace console.log with winston
grit apply '`console.log($msg)` => `winston.log($msg)`' ./src/

# Delete matches by rewriting to dot
grit apply '`debugger;' => .' ./src/
```

Always verify with `--dry-run` first. Language-specific targeting:

```bash
grit apply -l ts '`console.log($_)`' ./src/       # TypeScript only
grit apply -l py 'def $_($$$args) -> $_:' ./src/   # Python
```

## Using the Standard Library

200+ built-in patterns available by name:

```bash
grit apply no_console_log               # Remove console.log
grit apply react_to_hooks               # Class components → hooks
grit list                               # List all available patterns
```

Browse patterns at [github.com/biomejs/gritql-stdlib](https://github.com/biomejs/gritql-stdlib/tree/main/.grit/patterns). Import remote patterns in `.grit/grit.yaml`:

```yaml
patterns:
  - name: github.com/getgrit/stdlib#no_dead_code
    level: error
```

## Saving Patterns for Reuse

Store patterns in `.grit/patterns/` as `.md` or `.grit` files, then run by name:

```bash
mkdir -p .grit/patterns
# Create .grit/patterns/use_winston.md with the pattern body
grit apply use_winston ./src/
grit check   # Enforce as lint (fails on error/warn level patterns)
```

## Tips

- Use the [GritQL Studio](https://app.grit.io/studio) to experiment and debug syntax trees
- Patterns must be valid code in backticks — bare metavariables do not work
- Metavariable names: `$lowercase_snake_case`, anonymous is `$_`, spread is `$...`
