# gh

GitHub integration powered by the local `gh` CLI.

## Requirements

- `gh` installed and available in PATH.
- Auth configured (`gh auth login`) for private resources/mutations.

## What this extension covers

This extension exposes a broad GitHub surface area, including:

- Search: repos, code, issues, PRs
- Repo browsing/content: view, contents, file content, list files, clone
- Pull requests: list/view/create/merge
- Issues: list/view/create
- Releases, workflows/runs, labels
- Gists: list/get/create/update/delete/clone

## Safety behavior

Mutation/destructive operations are guarded with confirmation prompts via shared `dangerousOperationConfirmation` helpers.

## Output style

- Human-readable tables/details in tool text output.
- Structured metadata in `details` for downstream tool chaining.

## Scope note

`agent/extensions/gh/index.ts` also contains additional wrapper functions for more `gh` subcommands than the tool list currently registers. Treat the registered tool names as the public API.
