---
description: Audit source files for superfluous comments, section dividers, and useless noise — then delete them all
---

## Rule 1: No Narrator Comments

Narrator comments describe WHAT code does when the code already says it. The function name, variable name, or surrounding context makes the comment redundant.

**Definite narrator patterns:**

- `// FunctionName does X` where `FunctionName` already conveys X
- `// Remove/Create/Build/Parse/Format/Validate/Update/Delete/Check/Process/Generate/Manage/Track/Render/Load/Store/Filter/Extract/Convert ...` at the top of a function that matches the action
- `// Simulates/Tests/Mocks/Stubs/Sets up/Wires/Cycles ...` in test files describing what the test code does
- `// Wrap from last to first`, `// Cycle through all filter types and wrap back to class` — step-by-step descriptions of test flow
- `// Multi-line cell — wrap each segment, join with newlines, then re-split` — algorithm walkthroughs above a block that just does the algorithm

**Not narrator (keep these):**

- `// Why` comments: explain non-obvious behavior, design rationale, or business logic
  - `"Wildcard pattern is active by default; only deactivate if exclude matches"`
  - `"Inline the custom.json palette so tests stay fully self-contained"`
  - `"Falls back to DEFAULT_THEME if settings cannot be loaded"`
- `// How` comments: explain how to perform an external process (e.g., finding the right search index)
- Comments on assertions explaining what a check verifies: `expect(execMock).toHaveBeenCalledTimes(1); // Only checks empty status`

## Rule 2: No Section Dividers in Comments

Section dividers made of punctuation (`---`, `===`, `___`) are a code smell indicating the file should be split. Do not use them inline. Split into separate files or functions instead.

```bash
# Search for comment line dividers
grep -rn --exclude-dir=node_modules '// [=-]\{3,\}' <dir>
```

## Rule 3: JSDoc Documents the API, Not Functionality

JSDoc (`/** ... */`) must document the **API contract** — what arguments a function accepts and what it returns. It must NOT describe what the code does internally or at a high level. TypeScript types already convey parameter/return information; JSDoc adds nothing by repeating them as prose.

### What JSDoc should document (the API)

```ts
// ✅ GOOD: @param/@returns match the type signature — they exist only to
//    describe behavior not expressible in types (e.g., error conditions).
/**
 * @throws If the server is unreachable.
 */
export function fetchUser(id: number): Promise<User> { ... }

/**
 * @example
 *   truncate("hello world", 5) // "hello"
 */
export function truncate(text: string, max: number): string { ... }
```

### What JSDoc should NOT document (functionality descriptions)

```ts
// ❌ BAD: Describes what the function does — code and types already show this.
/**
 * LRU cache utility for storing computed values.
 */
export function createLRUCache<K, V>(limit: number) { ... }

// ❌ BAD: Describes behavior in prose instead of documenting the contract.
/**
 * Push `--flag=value` for each element of an array argument.
 */
export function pushArrayFlag(args: string[], values?: string[], flagName: string): void { ... }

// ❌ BAD: Explains internal algorithm and context — not part of the API.
/**
 * Test whether a rule matches the current tool call.
 * For "command" context, `pattern` uses AST-like token matching...
 * For "file_name" context, `pattern` uses glob matching...
 */
function matchCommandRule(rule: GuardrailsRule, toolName: string, input: unknown): ... { ... }

// ❌ BAD: Module-level description — functionality, not an API contract.
/**
 * Shared utilities for package registry tools (npm, pypi, etc.).
 */
```

### Single-line field descriptions are exempt

Single-line `/** */` comments on type/interface properties serve as inline documentation and are exempt from this rule:

```ts
interface Column {
  /** Column header label */
  key: string;
  /** Right-align values (for numbers) */
  align?: "left" | "right";
}
```

### Deletion is the fix

If a `/** ... */` block describes functionality rather than documenting an API contract, **delete it entirely**. Do not replace with `//` comments or add empty @tags. The code and TypeScript types are the documentation.

## Audit Process

### Phase 1: Discovery — Find All Violations

#### Step 1a: Use ast-grep to find orphaned comments

ast-grep finds all comments that do NOT immediately precede a class or function declaration. These are the candidates for review — inline notes, trailing remarks, mid-block explanations.

```bash
# Save the rule once, reuse it
cat > /tmp/orphaned-comments.yaml << 'RULE'
id: orphaned-comments
language: TypeScript
rule:
  kind: comment
  all:
    - not:
        precedes:
          any:
            - kind: function_declaration
            - kind: function_expression
            - kind: arrow_function
            - kind: class_declaration
            - kind: method_definition
            - kind: property_identifier
            - kind: property_signature
            - kind: public_field_definition
            - kind: lexical_declaration
            - kind: variable_declaration
            - kind: import_statement
            - kind: export_statement
            - kind: interface_declaration
            - kind: type_alias_declaration
            - kind: enum_declaration
RULE

# Scan a directory for orphaned comments
ast-grep scan --rule /tmp/orphaned-comments.yaml <dir>/
```

This catches:

- Inline `//` comments inside functions that describe what the code does
- Trailing comments after statements (`const x = y; // calculate result`)
- Test section headers (`// Extension Registration`)
- Multi-line inline explanations inside function bodies
- Module-level JSDoc not directly attached to a declaration

It properly excludes:

- JSDoc documenting functions, classes, methods, parameters
- `/** field doc */` on interface/type properties
- Comments preceding `const`, `let`, `var` declarations
- Comments before imports/exports/interfaces/types/enums

#### Step 1b: Find functionality-describing JSDoc blocks

Any `/** */` block on a declaration (function, const, interface) that lacks `@param`, `@returns`, `@return`, or `@throws` tags describes functionality rather than the API contract. These should be deleted. Single-line field descriptions on type/interface properties are exempt.

#### Step 1c: Section dividers

```bash
grep -rn --exclude-dir=node_modules '// [=-]\{3,\}' <dir>
```

### Phase 2: Triage — Separate Valid Comments from Noise

For each match, read the surrounding code and decide:

| Comment type                                                             | Keep? | Reason                                        |
| ------------------------------------------------------------------------ | ----- | --------------------------------------------- |
| `// Remove script and style nodes` above `function removeEmbeddedCode()` | NO    | Function name already says it                 |
| `// Simulates a repo where commits branch off` in test                   | NO    | Test code shows the setup                     |
| `// Wildcard pattern is active by default`                               | YES   | Explains business logic not visible from code |
| `// Inline palette so tests stay self-contained`                         | YES   | Explains design rationale                     |
| `// Force truecolor so mock output matches TTY behavior`                 | YES   | Explains test setup choice                    |

### Phase 3: Fix All Violations

Remove each superfluous comment, section divider, or invalid JSDoc block. Do NOT replace with alternatives — deletion is the fix.

Apply fixes file by file. After each file:

1. Run `bunx prettier --write <file>` to format
2. Verify no other issues introduced

### Phase 4: Verification — Check for Remaining Violations

After all fixes, re-run the ast-grep orphaned comments scan. It should return zero results (or only known-valid comments):

```bash
# Should return empty — no orphaned comments remain
ast-grep scan --rule /tmp/orphaned-comments.yaml <dir>/
```

Any remaining matches need manual review. Re-run the section divider grep as well.

## Key Decision Matrix

```
Does the comment explain WHY something is done?     → KEEP (rationale, business logic)
Does the comment explain HOW to do an external task? → KEEP (maintenance instructions)
Does the comment say WHAT code does?                → DELETE (code says it)
Does the comment describe TEST FLOW step-by-step?   → DELETE (test code shows it)
Is /** ... */ describing functionality, not API?    → DELETE (code + types are the docs)
```
