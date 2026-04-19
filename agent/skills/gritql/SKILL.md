---
name: gritql
description: Searches and rewrites codebases using GritQL declarative queries. Use when refactoring across languages, migrating dependencies, enforcing code patterns, or applying complex AST-level transformations at scale.
---

# gritql

GritQL (`grit`) searches and rewrites source code using a declarative query language backed by tree-sitter. Any valid code snippet in backticks is a pattern — no AST vocabulary required. Install once: `curl -fsSL https://docs.grit.io/install | bash` or `npm install --location=global @getgrit/cli`.

## Workflow

### 1. Search (find matches, dry-run by default for inline patterns)

```bash
grit apply '`console.log($_)`' ./src/
```

Patterns match structurally — whitespace and formatting variations are handled automatically. See [references/patterns-fundamentals.md](references/patterns-fundamentals.md) for metavariables and AST nodes.

### 2. Rewrite (in-place modification)

```bash
# Replace console.log with winston
grit apply '`console.log($msg)` => `winston.log($msg)`' ./src/

# Delete matches by rewriting to dot
grit apply '`debugger;' => .' ./src/
```

Always verify with `--dry-run` first. See [references/patterns-fundamentals.md](references/patterns-fundamentals.md) for rewrite syntax and [references/conditions.md](references/conditions.md) for constraints.

### 3. Language targeting

```bash
grit apply -l ts '`console.log($_)`' ./    # TypeScript only
grit apply -l py 'def $_($$$args) -> $_:' ./ # Python
```

See [references/cli-quickstart.md](references/cli-quickstart.md) for all CLI options.

## Using the Standard Library

Grit ships with 200+ patterns. Run them by name:

```bash
grit apply no_console_log                      # remove console.log
grit apply react_to_hooks                       # class → hooks
grit apply 'remove_import(from=`"react"`)'      # pattern with arguments
```

Browse all standard library patterns at [github.com/biomejs/gritql-stdlib/tree/main/.grit/patterns](https://github.com/biomejs/gritql-stdlib/tree/main/.grit/patterns). List all available patterns: `grit list`. Import remote patterns in `.grit/grit.yaml`:

```yaml
patterns:
  - name: github.com/getgrit/stdlib#no_dead_code
    level: error
```

See [references/cli-quickstart.md](references/cli-quickstart.md) for config details.

## Saving Patterns for Reuse

Store patterns in `.grit/patterns/` as `.md` or `.grit` files, then run by name:

```bash
mkdir -p .grit/patterns
# Create .grit/patterns/use_winston.md with the pattern body
grit apply use_winston ./src/
grit check   # enforce as lint (fails on error/warn level patterns)
```

Test patterns with `grit patterns test --watch`. See [references/advanced-patterns.md](references/advanced-patterns.md) for file structure.

## Tips

- Use the [GritQL Studio](https://app.grit.io/studio) to experiment and debug syntax trees
- Patterns must be valid code in backticks — bare metavariables do not work
- Metavariable names follow `$lowercase_snake_case`; anonymous is `$_`; spread is `$...`
- See [references/modifiers.md](references/modifiers.md) for context predicates (`within`, `after`) and [references/scoping-bubble.md](references/scoping-bubble.md) for multi-match scoping
