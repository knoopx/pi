Audit the entire codebase for violations of the rules below and fix them.

## Comments

- No narrator comments like `// This function handles user authentication` or `// Initialize x`.
- No numbered step markers (`Step 1:`, `Step 2:`).
- No section dividers made of punctuation (`---`, `===`). Split into separate files or functions instead.
- No hedging language (`should work`, `hopefully`, `not sure if`, `probably not the best`). Fix the code or file a tracked issue.
- No overconfident claims (`obviously`, `clearly`, `trivial`, `of course`).
- No unverified assumptions stated as fact. Add validation or delete the comment.
- No comments that restate what the code already says (obvious comments).
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
- No re-export shim files or barrel files. Import from the source.
- No unnecessary IIFE wrappers at module level. Use top-level async or direct execution.
- No type aliases that mirror another type. Use the original name.
- No identifier aliases (`import { X as Y }`). Rename at the source.
- Detect and remove copy-pasted code (duplicate logic across files).
- No unnecessary spread operator usage (`...obj`) when destructuring or passing props.

## Indirection

- No thin wrapper functions that only delegate to another function. Import from the source.
- No unnecessary indirection levels. If a function does nothing but call one other function, remove it.
- No render helper functions that build output with string concatenation or template literals. Use proper components.

## Dead Code

- No commented-out code blocks. Delete them.
- No `@deprecated` annotations without a stated replacement or migration path. Migrate consumers and delete.
- No legacy markers (`legacy`, `obsolete`, `old implementation`). Remove the code.
- No unnecessary state changes that cause flicker or redundant re-renders.
- No leftovers after refactoring. Clean up all dead code, unused imports, and orphaned files.
- No `@file` or `@fileoverview` file headers.

## Security

- No hardcoded secrets, API keys, or credentials.
- No hardcoded logic that should be configurable. Extract to config or design tokens.
- No string concatenation for queries or commands. Use parameterized interfaces.
- No `eval()` calls.
- No `console.log` or `debugger` statements in production code.

## Data and Configuration

- No hardcoded color constants. Extract to theme or design tokens.
- No hardcoded file paths. Resolve dynamically via PATH env or platform APIs.
- No placeholder data (mock values, fake names like "John Doe", dummy IDs). Replace with actual values.
- No dynamic imports wrapped in try-catch-return patterns. Use static imports or fail visibly.
- No temp files for data passing between commands. Pipe directly.
- No optional fallbacks on required data. Auto-detect and pre-select; fail if detection fails.

## Structure

- One component per file for TUI components. No multiple classes or components in one file.
- No test code in production files.
- Do not copy, move, or create dedicated fixture files for tested scenarios. Use real data.
- Update existing files; do not create new ones when an existing file should be modified.
- For TUI line truncation, use `visibleWidth()` to measure and `truncateToWidth()` to truncate.

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
- Use library-provided types; do not invent custom types when a standard one exists.
- No `@ts-ignore` or `@ts-expect-error` without clear explanation.
- No regex hacks for parsing structured data. Use proper parsers.

## Tooling

- Use Bun, not Node.js. No `node` commands; use `bun` or `bunx`.
- Do not use `cat` to read files. Use Node.js APIs (`fs.readFileSync`, etc.) or the `read` tool.
- Do not disable lint rules to fix issues. Fix the underlying problem instead.
- Remove unused exports and files; re-check until clean.
- No arbitrary timeouts in code.

## Naming

- No unnecessary prefixes on symbols or files.
- Consistent naming across files, directories, and symbols. Rename both files and their exported identifiers together.
- Use meaningful namespaces based on usage; config-related items get a `config` suffix.
- No god classes. Split by concern into separate classes with interfaces.
- No mixing concerns in the same class or file. Separate each responsibility into its own class.
- Properly name rules; do not use default names.

## Architecture

- No global methods or global state. Use proper dependency injection (e.g., pass theme via constructor).
- Object-oriented architecture over procedural code. Introduce data models, dataset classes, and service directories.
- Split large catch-all files. One file per concern.
- No backward compatibility layers. Proper fix only.

## Testing

- Use vitest; do not use `bun test`.
- Write snapshot tests for UI components and validate outputs for all states.
- Each component state should have its own snapshot.
- Do not write rendering output stability tests — they are meaningless.
- Use realistic paths in tests, not dummy values.
- Do not copy, move, or create dedicated fixture files for tested scenarios. Use real data.

## TUI Components

- Use pi-tui primitives and APIs; do not build with string concatenation or line-based rendering.
- No manual caching of rendered output. Let the framework handle it.
- Pass theme via constructor, never access global state.
- Every component lives in its own file — no barrel re-exports.

## Cleanup

- Remove useless spacing and comments from code.
- Remove unnecessary padding, margins, or grouping that adds no value.
