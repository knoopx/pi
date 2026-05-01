Audit the entire codebase for violations of the rules below and fix them.

## Comments

- No narrator comments like `// This function handles user authentication` or `// Initialize x`.
- No numbered step markers (`Step 1:`, `Step 2:`).
- No section dividers made of punctuation (`---`, `===`). Split into separate files or functions instead.
- No hedging language (`should work`, `hopefully`, `not sure if`, `probably not the best`). Fix the code or file a tracked issue.
- No overconfident claims (`obviously`, `clearly`, `trivial`, `of course`).
- No unverified assumptions stated as fact. Add validation or delete the comment.

- Block comments using `/** ... */` must contain valid JSDoc tags (`@param`, `@returns`) or be deleted.

## Incomplete Work

- No stub throws like `throw new Error("not implemented")`. Implement, remove, or reference a tracked issue.
- No TODO, FIXME, XXX, HACK, or NOTE comments standing alone. Complete the work and delete the marker, or replace with an issue tracker reference.
- No no-op functions or handlers (`noop`, `do nothing`, empty stubs). Implement or remove.
- No fallback defaults on required data. Fail visibly.

## Error Handling

- Error messages must describe exactly what went wrong. No generic messages like `"Error occurred"`.
- Never send `error.message`, `error.stack`, or internal details in HTTP responses. Log server-side, return a generic message to the client.
- No empty catch blocks. Log, rethrow, or handle explicitly.

## Code Structure

- Maximum nesting depth: 4 levels. Flatten with early returns, extraction, or guard clauses.
- Maximum 80 lines per function (200 for test files). Split longer functions.
- Maximum 30 statements per function.
- Maximum 4 parameters per function. Use an options object or split the function.
- No more than one class per file.
- No unnecessary `else` when the `if` branch already returns.

## Simplicity

- No boilerplate wrapper functions that only call one other function with no transformation. Import directly.
- No re-export shim files. Import from the source.
- No unnecessary IIFE wrappers at module level.
- No type aliases that mirror another type. Use the original name.
- No import aliases (`import { X as Y }`). Rename at the source.

## Dead Code

- No commented-out code blocks. Delete them.
- No `@deprecated` annotations without a stated replacement or migration path. Migrate consumers and delete.
- No legacy markers (`legacy`, `obsolete`, `old implementation`). Remove the code.

## Security

- No hardcoded secrets, API keys, or credentials.
- No string concatenation for queries or commands. Use parameterized interfaces.
- No `eval()` calls.
- No `console.log` or `debugger` statements in production code.

## TypeScript

- No `any`. Use specific types or `unknown` with narrowing.
- No non-null assertions (`!`). Handle the null case explicitly.
- No unnecessary type assertions. Remove if it compiles without them.
- Prefer `interface` over `type` for object shapes.
- Use `import type` for type-only imports. Keep type and value imports separate.
- No unused variables or imports. Prefix intentionally unused parameters with `_`.
- No unhandled promises. Await or ignore explicitly with a why comment.
- No `require()` imports in TypeScript modules. Use ES module imports.
- Prefer `for...of` over indexed `for` when the index is not needed.

## Hallucinated Imports

- Every import must correspond to a real, installed package or a local module path. Verify against the registry when in doubt.
