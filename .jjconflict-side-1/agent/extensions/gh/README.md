# gh

GitHub integration powered by the local `gh` CLI.

## Requirements

- `gh` installed and available in PATH.
- Auth configured (`gh auth login`) for private resources/mutations.

## What this extension covers

This extension exposes a broad GitHub surface area, including:

- **Search**: repos, code, issues, PRs
- **Repo browsing**: view, contents, file content, list files, clone
- **Pull requests**: list/view/create/merge
- **Issues**: list/view/create
- **Releases, workflows/runs, labels**
- **Gists**: list/get/create/update/delete/clone

## Search Tools

### `gh-search-code`

Search for code across GitHub repositories using GitHub's code search syntax.

**Query qualifiers:**

| Qualifier          | Description               | Example                         |
| ------------------ | ------------------------- | ------------------------------- |
| `extension:ext`    | Filter by file extension  | `extension:nix`, `extension:ts` |
| `filename:pattern` | Match specific filenames  | `filename:flake.nix`            |
| `user:username`    | Limit to user's repos     | `user:nixos`                    |
| `owner:username`   | Limit to user/org's repos | `owner:microsoft`               |
| `repo:owner/name`  | Limit to specific repo    | `repo:facebook/react`           |
| `language:Lang`    | Filter by language        | `language:TypeScript`           |

**Examples:**

```typescript
// Search for Nix configurations
gh - search - code((query = "extension:nix programs.vim.enable"));
gh - search - code((query = "filename:flake.nix inputs.nixpkgs"));
gh - search - code((query = "user:nixos filename:configuration.nix"));

// Search by file type
gh - search - code((query = "extension:ts import React"));
gh - search - code((query = "filename:package.json dependencies"));

// Search within specific repos/users
gh - search - code((query = "owner:microsoft extension:ts"));
gh - search - code((query = "repo:facebook/react extension:tsx"));
```

### `gh-search-repos`

Search for repositories by name, description, language, stars, etc.

```typescript
gh - search - repos((query = "language:typescript stars:>1000"));
gh - search - repos((query = "react framework"), (limit = 10));
gh - search - repos((query = "owner:microsoft"));
```

### `gh-search-issues`

Search for issues across repositories.

```typescript
gh - search - issues((query = "is:open label:bug"));
gh - search - issues((query = "author:@me is:closed"));
```

### `gh-search-prs`

Search for pull requests across repositories.

```typescript
gh - search - prs((query = "is:open review:required"));
gh - search - prs((query = "author:@me is:merged"));
```

## Safety behavior

Mutation/destructive operations are guarded with confirmation prompts via shared `dangerousOperationConfirmation` helpers.

## Output style

- Human-readable tables/details in tool text output.
- Structured metadata in `details` for downstream tool chaining.

## Scope note

`agent/extensions/gh/index.ts` also contains additional wrapper functions for more `gh` subcommands than the tool list currently registers. Treat the registered tool names as the public API.
