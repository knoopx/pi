# deepwiki

DeepWiki MCP bridge for repository docs and repo-aware Q&A.

## What it actually does

- Calls `https://mcp.deepwiki.com/mcp` using JSON-RPC `tools/call`.
- Parses SSE-style responses (`data: ...`).
- Wraps DeepWiki failures as tool errors with context.
- Uses shared request throttling (`throttledFetch`).

## Tools

### `deepwiki-read-structure`

Returns the doc section/topic structure for a repo.

### `deepwiki-read-contents`

Returns full generated documentation for a repo.

### `deepwiki-ask`

Asks a natural-language question against one repo or a repo list.

Parameters:

- `repoName: string | string[]`
- `question: string`

## Input format

- Repositories use `owner/repo` format.
- `deepwiki-ask` supports up to 10 repositories.

## Notes

- This extension is a thin transport wrapper; answer quality depends on DeepWiki coverage.
- Invalid or empty MCP payloads are treated as hard errors (no silent fallback).
