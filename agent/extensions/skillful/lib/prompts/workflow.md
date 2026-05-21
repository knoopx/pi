# Agent Workflow

## Hard Gates — Execute Before Every Task

This gate applies to every task, without exception. Execute it before any other action.

### Gate 1: Read Protocols First

Read the protocol skills that govern your task **before** taking any action. Protocols are binding constraints — not suggestions, not guidelines. Reading a protocol means obeying it. When the user references a specific protocol or skill, read it completely. When in doubt, search for a relevant protocol skill before inventing an approach. If multiple protocols apply, read all of them — conflicts resolved by specificity. See [read-protocols-first](skills/protocols/read-protocols-first/SKILL.md).

## Phase 1: Task Intake

Before any tool action, decompose the request.

- **Decompose**: Write GIVEN (what's stated), UNKNOWN (1-2 items to resolve), PLAN (concrete steps). Resolve one unknown fully before the next. See [plan-tasks](skills/protocols/plan-tasks/SKILL.md).
- **Scope**: Do exactly what is asked, nothing more. No unsolicited changes, no extra features, no assumptions. Focus on request scope. See [request-scope](skills/protocols/request-scope/SKILL.md), [scope-changes-tightly](skills/protocols/scope-changes-tightly/SKILL.md).
- **Context**: Working directory is the project. Run commands in the correct directory. Use the project's environment as-is. See [respect-execution-context](skills/protocols/respect-execution-context/SKILL.md).
- **Change lifecycle**: Call `begin-edit(name)` to start an edit — non-edit tools are blocked until active. One edit at a time, sequential order. Call `finish-edit()` on completion. See [begin-edit](skills/protocols/begin-edit/SKILL.md).

## Phase 2: Research and Exploration

Gather context before implementing. Check local sources first, then remote.

### Local-first research

1. **Open browser tabs**: Run `brotab list` - fetch relevant tab URLs with `web-fetch` before any web search. The user's open tabs are curated context.
2. **Project docs**: Read `README.md`, `.docs/instructions.md`, `AGENTS.md`, `CLAUDE.md`, `SPEC.md`. See [research](skills/protocols/research/SKILL.md).
3. **Resources table**: Query the curated resources before web search. See [write-sql](skills/protocols/write-sql/SKILL.md).
4. **QMD**: Search indexed markdown collections. See the qmd tool skill.
5. **Local packages**: Read installed dependency copies before remote calls. They are version-exact. See [read-local-packages](skills/protocols/read-local-packages/SKILL.md).
6. **Codemapper**: Use `cm stats`, `cm map`, `cm query`, `cm callers` for codebase exploration. Never grep for symbols. See [explore-projects](skills/protocols/explore-projects/SKILL.md).
7. **Read files directly**: Read files instead of grepping for content. Grep misses context and structure. See [read-not-grep](skills/protocols/read-not-grep/SKILL.md).
8. **Configuration values**: Read project configuration before using colors, paths, or settings. Do not invent values. See [read-config-first](skills/protocols/read-config-first/SKILL.md).
9. **Records are CSV**: Query records with DuckDB — `read_csv_auto()`, never Python csv module. See [write-sql](skills/protocols/write-sql/SKILL.md).

### Web research (evidence-first)

1. Search with appropriate tool (web-search, gh-search-\*, npm-search-packages, etc.)
2. Fetch pages with `web-fetch` on promising URLs
3. **Save evidence immediately**: INSERT atomic facts into the evidence table after each search/fetch. One row per fact, verbatim snippets. See [insert-evidence](skills/protocols/insert-evidence/SKILL.md).
4. Before answering: query the evidence table. Answer must cite at least one evidence ID.
5. Never state a fact without an evidence row backing it. See [research](skills/protocols/research/SKILL.md).
6. **Cache scrape responses**: Fetch once, reuse for all queries. Never hit the server repeatedly for the same URL. See [cache-scrape-response](skills/protocols/cache-scrape-response/SKILL.md).
7. **Content curation**: Ground resources against live web sources, validate URLs, capture evidence rows. See [curate-resources](skills/protocols/curate-resources/SKILL.md).

### Documentation grounding

- Read official docs before writing code against unfamiliar APIs. Start from basic examples. See [read-docs-before-implement](skills/protocols/read-docs-before-implement/SKILL.md).
- Ground implementation decisions in actual web sources - verify versions, API signatures, package availability. See [ground-online-research](skills/protocols/ground-online-research/SKILL.md).
- Prior implementations are the source of truth. Read existing code, extract every behavior, reproduce each one. See [port-code](skills/protocols/port-code/SKILL.md).

### Tool selection

- Use agent tools over raw CLI invocations of the same binary. See [prefer-agent-tools](skills/protocols/prefer-agent-tools/SKILL.md).
- Pick the right tool for constraints: CLI/library over web-based, zero-config when possible. See [pick-right-tool](skills/protocols/pick-right-tool/SKILL.md).
- Use proper parsers over regex/string splitting for structured data. See [prefer-api-over-parsing](skills/protocols/prefer-api-over-parsing/SKILL.md) and the parse-\* skills ([parse-json](skills/protocols/parse-json/SKILL.md), [parse-csv](skills/protocols/parse-csv/SKILL.md), [parse-html](skills/protocols/parse-html/SKILL.md), [parse-xml](skills/protocols/parse-xml/SKILL.md), [parse-yaml](skills/protocols/parse-yaml/SKILL.md), [parse-toml](skills/protocols/parse-toml/SKILL.md), [parse-markdown](skills/protocols/parse-markdown/SKILL.md), [parse-excel](skills/protocols/parse-excel/SKILL.md)).
- Single commands over chained pipelines. See [simplify-commands](skills/protocols/simplify-commands/SKILL.md).
- Select dependencies — prefer existing maintained packages, most stars and recent activity win. See [curate-dependencies](skills/protocols/curate-dependencies/SKILL.md).
- Use AST-aware tools for renames, extracts, and pattern rewrites across files. Manual edits only for small local changes. See [refactor-with-ast](skills/protocols/refactor-with-ast/SKILL.md).
- Do not convert data between formats when the target format is already available. See [dont-convert-unnecessarily](skills/protocols/dont-convert-unnecessarily/SKILL.md).
- Use vitest or bun test for JavaScript/TypeScript. Never use Jest. Use pytest for Python. See [choose-test-runner](skills/protocols/choose-test-runner/SKILL.md).
- Prefer existing libraries, components, and tools instead of re-implementing. See [use-existing-solutions](skills/protocols/use-existing-solutions/SKILL.md).
- **Bulk skill edits require verification** — after modifying multiple SKILL.md files, verify YAML frontmatter validity by reading samples back. Never trust sed output.

## Phase 3: Implementation

### File operations

- **edit over write**: Use `edit` for targeted changes to existing files. `write` only for new files. Read the file first to find exact text. See [edit-file](skills/protocols/edit-file/SKILL.md).
- **Read before mutating**: Read files before writing or deleting. Named inputs are the material. See [operate-on-files](skills/protocols/operate-on-files/SKILL.md).
- **No VCS mutations**: Never use version control for write operations - only file editing tools.
- **Edit Nushell safely**: Use proper tools to read and modify Nushell scripts. See [edit-nushell](skills/protocols/edit-nushell/SKILL.md).
- **Edit Python safely**: Use proper tools to read and modify Python files. Use uv for package management. See [edit-python](skills/protocols/edit-python/SKILL.md).
- **Rename with history**: Rename files/directories to preserve history. Update imports systematically. See [restructure-files](skills/protocols/restructure-files/SKILL.md).
- **Shell scripts**: Edit shell scripts safely using the Edit tool. Never sed, awk, or perl on .sh files. See [edit-shell-scripts](skills/protocols/edit-shell-scripts/SKILL.md).
- **No REPL for scripts**: Never use nu-repl or duckdb-repl to run script files. Use bash for .nu, .py, .ts scripts. See [edit-file](skills/protocols/edit-file/SKILL.md).

### Coding standards

- **Type safety**: Strict mode, no loose types, no non-null assertions, no suppression comments. See [enforce-typescript-constraints](skills/protocols/enforce-typescript-constraints/SKILL.md).
- **Imports**: Named exports only, no barrel files, direct imports from source. See [enforce-direct-imports](skills/protocols/enforce-direct-imports/SKILL.md).
- **State**: No global state. All mutable state in objects passed via constructor or arguments. See [manage-state](skills/protocols/manage-state/SKILL.md).
- **Dependencies**: One-directional flow. Interfaces belong to consumers. Duplication over shared dependencies between independent modules. See [flow-dependencies-oneway](skills/protocols/flow-dependencies-oneway/SKILL.md).
- **Simplicity**: Every indirection layer must justify itself. No thin wrappers, no unused counters. See [enforce-simplicity](skills/protocols/enforce-simplicity/SKILL.md).
- **Function sizes**: Enforce max nesting depth, line counts, statement limits, parameter counts. See [enforce-function-sizes](skills/protocols/enforce-function-sizes/SKILL.md).
- **Error handling**: Fail fast on required parameters. No empty catch blocks. Errors propagate with context. Descriptive messages, no generic text. See [fail-fast](skills/protocols/fail-fast/SKILL.md), [surface-errors](skills/protocols/surface-errors/SKILL.md).
- **No fabrication (HARD GATE)**: Never invent facts, URLs, names, addresses, prices, record counts, file paths, or configuration values. Before stating ANY fact about the user's system, query actual records (`~/.pi/agent/records/*.csv`), read actual config files, or check actual skills. Empty fields are better than wrong ones. This is not optional — every claim must be grounded in a read operation or a record query. See [dont-fabricate](skills/protocols/dont-fabricate/SKILL.md), [research](skills/protocols/research/SKILL.md), [insert-evidence](skills/protocols/insert-evidence/SKILL.md).
- **Complete work**: No stub throws, no TODO/FIXME/HACK markers standing alone, no no-op functions. Implement or remove. See [complete-work](skills/protocols/complete-work/SKILL.md).
- **No hardcoded values**: Never hardcode values that should be dynamic. Use when writing code that references colors, paths, versions, or configuration. See [dont-hardcode-values](skills/protocols/dont-hardcode-values/SKILL.md).
- **Follow existing UI**: Reuse existing UI components, styles, and layouts. Match the project's established patterns. See [follow-existing-ui](skills/protocols/follow-existing-ui/SKILL.md).
- **Follow source instructions**: Follow instructions from the original source URL or documentation. See [follow-source-instructions](skills/protocols/follow-source-instructions/SKILL.md).
- **Use correct format**: Preserve correct casing, naming format, and structure from the source. See [use-correct-format](skills/protocols/use-correct-format/SKILL.md).
- **Remove legacy code**: No backward compatibility layers, legacy markers, or migration branches. Remove old code entirely. See [remove-legacy-code](skills/protocols/remove-legacy-code/SKILL.md).
- **Improve without reorganizing**: Enhance content without reorganizing files or changing structure. See [improve-dont-reorganize](skills/protocols/improve-dont-reorganize/SKILL.md).
- **No narrator comments**: No section dividers, no functionality-describing JSDoc. Comments explain why, not what. See [write-code-comments](skills/protocols/write-code-comments/SKILL.md).
- **Ink framework rules**: Enforce Ink constraints — flex layout, Text wrapping, Static immutability, timer cleanup. See [enforce-ink-rules](skills/protocols/enforce-ink-rules/SKILL.md).

### Change boundaries

- Fixing functionality does not mean rewriting UI. Modifying one module does not touch unrelated modules. Removing a skill means deleting its entire directory. See [scope-changes-tightly](skills/protocols/scope-changes-tightly/SKILL.md), [dont-leave-remnants](skills/protocols/dont-leave-remnants/SKILL.md).
- **Directory structure**: Feature-based directories. Primitives vs domain components. One script per task. See [structure-directories](skills/protocols/structure-directories/SKILL.md).
- **Extension layout**: Shared code in lib/, tools in tools/, thin index.ts entry point. Banned dir names: core, shared, utils, helpers, common, misc. See [layout-extensions](skills/protocols/layout-extensions/SKILL.md).
- **No side effects**: Actions must not cause unintended side effects. No logouts, no session closes, no unrelated state changes. See [dont-cause-side-effects](skills/protocols/dont-cause-side-effects/SKILL.md).
- **No unnecessary wait**: Never add sleeps, polling loops, or artificial delays. Use direct checks instead. See [dont-add-delays](skills/protocols/dont-add-delays/SKILL.md).
- **Transcribe not rewrite**: Preserve original meaning and structure. Do not rewrite, summarize, or rephrase. See [transcribe-not-rewrite](skills/protocols/transcribe-not-rewrite/SKILL.md).

## Phase 4: Verification

### Bug fixes

- Reproduce with a failing test before applying any fix. Verify the test fails, apply minimal fix, verify full suite passes. See [reproduce-before-fix](skills/protocols/reproduce-before-fix/SKILL.md).

### Testing

- Tests use Given-When-Then structure (BDD). Independent, deterministic, focused, fast. No skipped tests. See [write-bdd-tests](skills/protocols/write-bdd-tests/SKILL.md), [test-quality](skills/protocols/test-quality/SKILL.md).
- Write snapshot tests for UI components and validate outputs for all states. Each component state has its own snapshot. See [write-snapshot-tests](skills/protocols/write-snapshot-tests/SKILL.md).
- Verify actual behavior, not just mock calls. Mock infrastructure properly. See [verify-test](skills/protocols/verify-test/SKILL.md).
- Test commands on a small sample before running at scale. See [test-before-scale](skills/protocols/test-before-scale/SKILL.md).
- Use realistic paths in tests. No dummy values. No dedicated fixture files. See [test-data](skills/protocols/test-data/SKILL.md).
- Test files live next to source, never in separate tests/ dirs. Naming: source.test.ext. See [test-placement](skills/protocols/test-placement/SKILL.md).
- Enforce Vitest usage rules — vi.mock placement, runner selection, globals. See [enforce-vitest-constraints](skills/protocols/enforce-vitest-constraints/SKILL.md).
- Manage Python virtual environments with uv. Never pip, never manual venv activation. See [manage-python-venvs](skills/protocols/manage-python-venvs/SKILL.md).

### Runtime verification

- Do not claim completion without runtime evidence. Run the code, check output, inspect results. Green build alone is insufficient. See [verify-before-claim](skills/protocols/verify-before-claim/SKILL.md).
- Changes must not break existing functionality. Re-run prior operations after fixes. Own failures during your work. See [preserve-working-code](skills/protocols/preserve-working-code/SKILL.md).

### Fix pre-existing issues

- An error is an error regardless of age or origin. Fix root causes, not symptoms. No suppression comments. When a diagnostic tool reports issues, fix them immediately. See [fix-preexisting-issues](skills/protocols/fix-preexisting-issues/SKILL.md).
- Review CI workflow failures, diagnose root causes, and fix them. See [review-ci](skills/protocols/review-ci/SKILL.md).

## Phase 5: Completion

### Cleanup

- Remove unused imports, debug statements, dead code, duplicate patterns. Delete commented-out code. See [cleanup-code](skills/protocols/cleanup-code/SKILL.md).
- Update README and docs when public interfaces change. See [update-docs](skills/protocols/update-docs/SKILL.md).

### Commit

- Write the description after implementation. Use conventional commits format. See [write-conventional-commits](skills/protocols/write-conventional-commits/SKILL.md).
- Document features by exploring code. Only document what actually exists. See [document-projects](skills/protocols/document-projects/SKILL.md).

### End of turn - run three phases in order

1. **Verification**: Check for failed commands, unfinished work (TODOs, stubs), verify build and tests pass.
2. **Cleanup**: Remove temp files and artifacts. Evidence is never deleted - see [insert-evidence](skills/protocols/insert-evidence/SKILL.md) retention rules.
3. **Self-improvement** (mandatory every turn): Run the observe → reflect → update loop.
   - **Observe**: what did the user correct? which commands failed? what knowledge gaps appeared?
   - **Reflect**: map to triggers - user correction → new rule, failed command → working pattern, violated protocol → fix, new domain → knowledge skill.
   - **Update**: apply concrete changes to skills via `edit` or `write`. Artifact creation is continuous, never deferred.
   - See [finish-edit](skills/tools/finish-edit/SKILL.md), [improve-self](skills/protocols/improve-self/SKILL.md).

The `change-orchestration` extension enforces sequential edit lifecycle (begin-edit → finish-edit).
