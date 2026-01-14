---
name: ast-grep
description: Find complex code patterns and perform safe structural code transformations across projects using ast-grep.
---

# ast-grep Skill

This skill provides specialized workflows and reference documentation for using `ast-grep` (also known as `sg`) to perform structural search and replace across a codebase using command-line arguments.

## Setup

Ensure `ast-grep` is installed:

```bash
ast-grep --version
```

## Usage

### Basic Structural Search

Find code matching a pattern in a specific language:

```bash
ast-grep run --pattern 'console.log($$$ARGS)' --lang javascript
```

### Structural Search and Replace

Rewrite code by matching a pattern and providing a replacement:

```bash
ast-grep run --pattern 'if ($A == $B) { $S }' --rewrite 'if (Object.is($A, $B)) { $S }' --lang typescript
```

### Advanced Structural Search (Inline Rules)

For complex queries involving logic (all, any, not) or relationships (inside, has), use `--inline-rules`:

```bash
ast-grep scan --inline-rules "{id: find-async, language: javascript, rule: {all: [{kind: function_declaration}, {has: {pattern: await \$EXPR, stopBy: end}}]}}"
```

### In-place Updates

Apply changes directly to files without confirmation:

```bash
ast-grep run --pattern '$A && $A.prop' --rewrite '$A?.prop' --lang javascript --update-all
```

## Workflow

1.  **Identify the language**: Determine the programming language (e.g., `javascript`, `python`, `go`).
2.  **Debug the AST**: If you don't know the node name (`kind`), use the debug flag:
    ```bash
    ast-grep run --pattern 'code snippet here' --lang lang --debug-query=cst
    ```
3.  **Define the search pattern**: Use placeholders like `$VAR` (single node) or `$$$ARGS` (multiple nodes).
4.  **Test the search**: Run `ast-grep run --pattern '...' --lang ...` to verify matches.
5.  **Apply and verify**: Use the `--rewrite` flag with `--update-all` to apply changes.

## Cheat Sheet

### Pattern Syntax

- `$VAR` : Matches a single AST node and captures it as `VAR`.
- `$$$VAR` : Matches zero or more AST nodes (spread) and captures them as `VAR`.
- `$_` : Anonymous placeholder (matches any single node but doesn't capture).
- `$$$_` : Anonymous spread placeholder (matches any number of nodes).

### Rule Syntax (for --inline-rules)

| Property      | Purpose                                                                 |
| :------------ | :---------------------------------------------------------------------- |
| `kind`        | Matches AST node by its kind name (found via `--debug-query`).          |
| `inside`      | Target node must be inside node matching sub-rule (use `stopBy: end`).  |
| `has`         | Target node must have descendant matching sub-rule (use `stopBy: end`). |
| `all` / `any` | Logical AND / OR for multiple sub-rules.                                |
| `not`         | Negation of a sub-rule.                                                 |

**Important**: When using `$VAR` in a shell command string, escape it as `\$VAR` or use single quotes for the entire rule string.

### Practical Command Examples

| Task                      | Command                                                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Find React `useEffect`    | `ast-grep run --pattern 'useEffect(() => { $$$BODY }, [$DEPS])' --lang tsx`                                                         |
| Simplify Boolean return   | `ast-grep run --pattern 'if ($COND) { return true } else { return false }' --rewrite 'return !!$COND' --lang javascript`            |
| Convert to Arrow Function | `ast-grep run --pattern 'function $NAME($$$ARGS) { $$$BODY }' --rewrite 'const $NAME = ($$$ARGS) => { $$$BODY }' --lang javascript` |
| Remove Debugger           | `ast-grep run --pattern 'debugger' --rewrite '' --lang javascript`                                                                  |

### Supported Languages

`javascript`, `typescript`, `tsx`, `html`, `css`, `python`, `go`, `rust`, `java`, `c`, `cpp`, `csharp`, `ruby`, `php`, `yaml`.

### Command Line Flags

- `--pattern`, `-p`: The pattern to search for.
- `--lang`, `-l`: The language of the source files.
- `--rewrite`, `-r`: The replacement pattern.
- `--update-all`, `-u`: Apply all rewrites without confirmation.
- `--json`, `-j`: Output matches in JSON format.
- `--debug-query`: Inspect AST structure (`cst`, `ast`, `pattern`).

## Related Skills

- **typescript**: Use ast-grep to find and refactor TypeScript code patterns safely.
- **python**: Apply structural search and replace to Python codebases with ast-grep.

## Related Tools

- **ast-search**: Perform structural code search using ast-grep patterns.
- **ast-replace**: Perform structural search and replace using ast-grep.
- **ast-scan**: Advanced structural search using ast-grep inline rules.
- **generate-codemap**: Generate a compact map of the codebase structure, symbols, and dependencies.
- **analyze-dependencies**: Analyze dependency tree for files or show external packages used in the project.
