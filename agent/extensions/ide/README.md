# IDE Extension

A development environment extension for pi that provides code browsing, Codemapper analysis, jujutsu workflows, and workspace management with split-panel TUI overlays.

## Features

- **Code browsing** - Browse files and symbols with syntax-highlighted previews
- **Codemapper integration** - Inspect symbols, callers, callees, tests, types, schema, and impact
- **Jujutsu integration** - Browse mutable changes, diff files, split/fixup/drop/new changes, and manage bookmarks
- **Operation log** - Browse and restore/undo jujutsu operations
- **Bookmark workflows** - Fuzzy bookmark picker, create bookmark from input, browse and push bookmarks (`name@remote`)
- **Move mode for changes** - Reorder mutable changes in the stack (`Ctrl+M`, then `↑/↓`, `Enter`)
- **Workspace management** - Create isolated jj workspaces and spawn subagents
- **Pull request browser** - Browse GitHub PRs with diff preview, checkout, approve, and merge
- **Skill browser** - Browse local/remote skills and install or insert `/skill:<name>`
- **Command palette** - Fuzzy-search slash commands and shortcuts from one overlay
- **Rich diffs** - Colorized diffs via delta
- **Quick navigation** - Keyboard shortcuts for fast access
- **Status footer** - Shows cwd, VCS state, model, API quota, context usage, and session cost
- **Session fork integration** - Auto-creates jj workspace when using `/fork`

## Commands

### `/files [query]`

Browse files with syntax-highlighted preview. Type to filter, enter to insert path into editor.

![Files](../../../screenshots/files.png)

| Key      | Action               |
| -------- | -------------------- |
| `↑/↓`    | Navigate             |
| `Enter`  | Insert path          |
| `Ctrl+E` | Open in VS Code      |
| `Ctrl+T` | Inspect file symbols |
| `Ctrl+I` | Insert path          |
| `Ctrl+D` | Show dependencies    |
| `Ctrl+U` | Show used-by         |
| `Esc`    | Exit                 |

### `/symbols [query]`

Browse code symbols (functions, classes, methods) with source preview. Enter inserts `path:line` reference, `Ctrl+I` inserts just the symbol name.

![Symbols](../../../screenshots/symbols.png)

| Key      | Action             |
| -------- | ------------------ |
| `↑/↓`    | Navigate           |
| `Ctrl+/` | Cycle type filter  |
| `Enter`  | Insert path:line   |
| `Ctrl+E` | Open in VS Code    |
| `Ctrl+T` | Show callers       |
| `Ctrl+I` | Insert symbol name |
| `Ctrl+L` | Show callees       |
| `Ctrl+J` | Show tests         |
| `Ctrl+Y` | Show types         |
| `Ctrl+S` | Show schema        |
| `Esc`    | Exit               |

### `/todos [query]`

Browse TODO, FIXME, HACK, and XXX comments across the codebase using ast-grep AST comment node matching. Source preview scrolls to the comment.

![TODOs](../../../screenshots/todos.png)

| Key      | Action                         |
| -------- | ------------------------------ |
| `↑/↓`    | Navigate                       |
| `Enter`  | Select                         |
| `Ctrl+T` | Inspect comment                |
| `Ctrl+I` | Insert `path:line comment`     |
| `Type`   | Filter by comment text or path |
| `Esc`    | Exit                           |

### `/bookmarks`

Browse bookmarks in `name@remote` format (`name@` for local bookmarks).

![Bookmarks](../../../screenshots/bookmarks.png)

| Key      | Action               |
| -------- | -------------------- |
| `↑/↓`    | Navigate             |
| `Ctrl+/` | Cycle filter mode    |
| `Ctrl+D` | Forget bookmark      |
| `Ctrl+G` | Git fetch            |
| `Ctrl+P` | Git push bookmark    |
| `Ctrl+I` | Insert bookmark name |
| `Esc`    | Exit                 |

### `/changes`

Browse all mutable jujutsu changes with file/diff preview.

![Changes](../../../screenshots/changes.png)

**Changes pane:**

| Key      | Action                                         |
| -------- | ---------------------------------------------- |
| `Tab`    | Switch focus                                   |
| `↑/↓`    | Navigate                                       |
| `Ctrl+/` | Cycle revision filter                          |
| `Space`  | Toggle selected change                         |
| `n`      | Create new change after selected change        |
| `e`      | Edit change                                    |
| `r`      | Revert change                                  |
| `d`      | Describe selected changes (or focused change)  |
| `s`      | Split change                                   |
| `f`      | Fixup (squash into parent)                     |
| `Ctrl+M` | Enter move mode (`↑/↓` move, `Enter` apply)    |
| `i`      | Insert change ID                               |
| `b`      | Set bookmark on change (picker + create)       |
| `Ctrl+P` | Push all bookmarks pointing to selected change |
| `Ctrl+D` | Drop change                                    |

#### Describe Workflow

Select changes with `Space`, then press `d` to generate conventional commit descriptions via the agent.

![Describe](../../../screenshots/describe.png)

**Files pane:**

| Key               | Action                 |
| ----------------- | ---------------------- |
| `Tab`             | Switch focus           |
| `↑/↓`             | Navigate               |
| `e`               | Open file in VS Code   |
| `d`               | Discard file changes   |
| `Ctrl+T`          | Inspect file symbols   |
| `Ctrl+I`          | Insert file path       |
| `Ctrl+D`          | Show file dependencies |
| `Ctrl+U`          | Show file used-by      |
| `Shift+PgUp/PgDn` | Scroll diff            |
| `Esc`             | Exit                   |

### `/oplog`

Browse jujutsu operation log with restore and undo capability.

![Op Log](../../../screenshots/oplog.png)

| Key   | Action               |
| ----- | -------------------- |
| `↑/↓` | Navigate             |
| `r`   | Restore to operation |
| `u`   | Undo last operation  |
| `Esc` | Exit                 |

### `/workspaces`

Review all workspaces and their changes.

![Workspaces](../../../screenshots/workspaces.png)

**Workspaces pane:**

| Key      | Action                 |
| -------- | ---------------------- |
| `Tab`    | Switch focus           |
| `↑/↓`    | Navigate               |
| `n`      | New workspace + pi     |
| `a`      | Attach to tmux session |
| `r`      | Rebase & describe      |
| `e`      | Open in VS Code        |
| `t`      | Open terminal          |
| `Ctrl+D` | Delete workspace       |

**Files/Changes pane:**

| Key               | Action       |
| ----------------- | ------------ |
| `Tab`             | Switch focus |
| `↑/↓`             | Navigate     |
| `d`               | Discard file |
| `Shift+PgUp/PgDn` | Scroll diff  |
| `Esc`             | Exit         |

### `/skills [query]`

Browse local and remote skills, preview files, install remote skills, or insert local skill invocation.

![Skills](../../../screenshots/skills.png)

| Key               | Action                                           |
| ----------------- | ------------------------------------------------ |
| `↑/↓`             | Navigate (focused pane)                          |
| `Tab`             | Switch skills/files pane                         |
| `Ctrl+/`          | Toggle local/remote view                         |
| `Enter`           | Install (remote) or insert `/skill:name` (local) |
| `Ctrl+D`          | Delete local skill                               |
| `Shift+PgUp/PgDn` | Scroll preview                                   |
| `Type`            | Filter skills                                    |
| `Esc`             | Exit                                             |

### `/pull-requests`

Browse GitHub pull requests with diff preview. Uses the `gh` CLI for GitHub API access.

![Pull Requests](../../../screenshots/pull-requests.png)

| Key      | Action                                     |
| -------- | ------------------------------------------ |
| `↑/↓`    | Navigate                                   |
| `Enter`  | Select PR                                  |
| `Ctrl+O` | Open PR in browser                         |
| `Ctrl+C` | Checkout PR branch                         |
| `Ctrl+A` | Approve PR                                 |
| `Ctrl+M` | Merge PR (squash)                          |
| `Ctrl+S` | Cycle filter (open/closed/merged/all)      |
| `Ctrl+T` | Inspect PR in browser                      |
| `Ctrl+I` | Insert PR reference                        |
| `Type`   | Filter by title, author, branch, or number |
| `Esc`    | Exit                                       |

**Filters** (cycle with `Ctrl+S`):

- Open - open pull requests (default)
- Closed - closed pull requests
- Merged - merged pull requests
- All - all pull requests

### `/workspace <task description>`

Create a new jj workspace from the current change and spawn a pi subagent in that workspace.

## Keyboard Shortcuts

| Shortcut | Action                 |
| -------- | ---------------------- |
| `Ctrl+P` | Open file picker       |
| `Ctrl+T` | Open symbol picker     |
| `Ctrl+B` | Open bookmarks browser |
| `Ctrl+J` | Open workspaces        |
| `Ctrl+K` | Open changes           |
| `Ctrl+O` | Open operation log     |
| `Ctrl+S` | Open skill browser     |
| `Ctrl+G` | Open pull requests     |

## Automatic Change Tracking

Each interactive prompt is tracked in jj only when the first write tool is executed:

1. If current change is empty, update its description with the prompt first line.
2. Otherwise create a new change with that description (`jj new -m`).

Readonly operations (for example `read`, and readonly shell commands like `ls`, `rg`, `find`, `jj log`, `git status`) do not create a new change.

## Status Footer

The extension provides a rich status footer displaying:

| Section               | Description                                   |
| --------------------- | --------------------------------------------- |
| **Working directory** | Current directory (shortened with `~`)        |
| **VCS state**         | Jujutsu change ID and bookmark, or git branch |
| **Session name**      | Current session identifier                    |
| **Model**             | Active model ID and thinking level            |
| **API quota**         | Usage percentage for rate-limited providers   |
| **Session cost**      | Total cost for the current session            |
| **Context usage**     | Percentage of context window used             |

**API Quota Providers:**

The footer fetches quota information from:

- **Anthropic** - Claude API rate limits
- **OpenAI** - GPT API rate limits
- **Gemini** - Google AI rate limits
- **GitHub Copilot** - Copilot usage quota
- **Z.AI (GLM Coding Plan)** - Z.AI API token and MCP usage limits

Quota is refreshed every 5 minutes and displayed as percentage with color coding (green < 70%, yellow 70-90%, red > 90%).

## Session Fork Integration

When using `/fork` to create a new session, the extension automatically:

1. Creates a new jj workspace branched from the current change
2. Spawns a pi subagent in the new workspace via tmux
3. Monitors the workspace for completion

This enables parallel development workflows with isolated version control.

## Dependencies

- `jj` - Jujutsu version control
- `gh` - GitHub CLI for pull requests
- `rg` - Fast file search
- `cm` - Codemapper for symbol indexing
- `tmux` - Session management for subagents
- `code` - VS Code CLI for opening files from overlays

## Syntax Highlighting

All syntax highlighting is performed using **Shiki**, providing consistent, theme-aware code previews across all components including:

- File previews
- Diff rendering with syntax-colored additions/deletions
- Grep results
