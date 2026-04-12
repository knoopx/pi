# duckduckgo

DuckDuckGo web search extension with two scraping strategies.

## What it actually does

1. Tries the dynamic DuckDuckGo preload endpoint (`links.duckduckgo.com/d.js`).
2. Falls back to `https://html.duckduckgo.com/html/` parsing.
3. Normalizes HTML snippets into single-line text.
4. Renders result tables with title, snippet, and URL.

## Tool

### `search-duckduckgo`

Parameters:

- `query: string`
- `limit?: number` (default `10`)

Returns:

- Text table for humans.
- Structured `details` with `query`, `limit`, and raw results.

## Reliability notes

- Requests are throttled via shared host slots.
- Empty result sets return a clean `No results found.` response.
- Network/HTTP failures are surfaced with HTTP status when available.
