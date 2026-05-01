Document all extension features in README.md and ensure every feature has a matching screenshot. Use CodeMapper (`cm`) to explore the codebase, not direct file reads.

## Step 1: Discover features via cm

Run `cm --help` or `cm map <dir> --level 2 --format ai` to discover all commands, subcommands, and components. Identify what is documented in README.md versus what is missing from the source.

- `cm query <symbol> --show-body` — inspect a component function signature and implementation
- `cm callers <symbol> --format ai` — find test files and usage sites
- `cm inspect <file>` — list all symbols in a file with line numbers

## Step 2: Find missing snapshot tests

Compare IDE components against existing `.test.ts` files. Components without snapshot tests need them so they can generate screenshots via render-screenshots.sh.

For each missing component:

1. Use `cm query createXxxComponent --show-body` to understand the constructor signature and config options
2. Use `cm callers createMockTheme` or inspect existing test files to learn the mock pattern
3. Create a `.test.ts` that calls `createListPicker` (or equivalent) with mocked `pi.exec`, mocks `tui`, uses `createMockTheme()`, and renders output via `expect(result).toMatchSnapshot()`

Test patterns:

- Mock `pi.exec` to return structured data matching the component's expected format (JSON for PRs, pipe-delimited for oplog, ast-grep JSON for todos)
- Use `await vi.waitFor(() => !lines.some(l => l.includes("Loading")))` before asserting loaded state
- Include tests for: loading state, error state, empty state, single item, multiple items, focused item, narrow/wide widths
- Name snapshot exports descriptively (e.g., `"renders multiple bookmarks with consistent padding"`)

## Step 3: Update render-screenshots.sh config

Add entries to the `FEATURES` map in `screenshots/render-screenshots.ts`. Each entry maps a feature name to:

- `snap`: absolute path to the `.snap` file (under `agent/extensions/.../__snapshots__/`)
- `test`: substring matching the snapshot export name to render

Run `./screenshots/render-screenshots.sh` to generate PNG files via charm-freeze. Verify output sizes are reasonable (> 5 KB).

## Step 4: Update README.md

For each undocumented feature, add a section following the existing pattern:

```markdown
### Feature Name

One-line description of what it does and how data is sourced.

![FeatureName](screenshots/feature.png)

**Keys:** `key1` action · `key2` action · `Esc` exit
```

Rules:

- Use the actual screenshot filename from step 3
- List keyboard shortcuts in the component's actions array (use `cm query createXxxComponent --show-body`)
- Describe data source (jj, gh CLI, ast-grep, etc.)
- Include `/command` entries in the Commands table
- Add shortcut bindings to the Keyboard Shortcuts table if applicable

## Step 5: Verify completeness

Run `cm map agent/extensions --level 2 --format ai` and verify every extension directory has corresponding README documentation. Cross-check that all `.png` files in screenshots/ have matching README image references. Run tests with `bunx vitest run --update` to ensure snapshots are current.
