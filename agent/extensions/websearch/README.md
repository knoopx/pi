# Websearch Extension

Consolidated web search tools for DuckDuckGo, npm, PyPI, Nix, and Hugging Face.

## Tools

### web-search

Search using DuckDuckGo. Two scraping strategies with automatic fallback.

**Parameters:**

- `query` (string): Search query
- `limit` (number, optional): Number of results (default 10)

### npm-search-packages

Search for packages on the npm registry.

**Parameters:**

- `query` (string): Search query for npm packages
- `size` (number, optional): Number of results (default 10, max 100)

### pypi-search-packages

Search for Python packages on PyPI.

**Parameters:**

- `query` (string): Search query (package name or keyword)
- `limit` (number, optional): Maximum results (default: 10, max: 50)

### nix-search-packages

Find packages in the NixOS package repository.

**Parameters:**

- `query` (string): Search query (package name, description, or programs)

### nix-search-options

Find configuration options in NixOS.

**Parameters:**

- `query` (string): Search query (option name or description)

### hm-search-options

Find configuration options for Home Manager.

**Parameters:**

- `query` (string): Search query (option name or description)

### hf-search-models

Search Hugging Face models with filters (tags, author, pipeline, library, date, gated, sort).

**Parameters:**

- `query` (string): Search query (e.g. 'Qwen GGUF')
- `filter` (string, optional): Comma-separated tag filters
- `author` (string, optional): Author/org filter
- `pipeline` (string, optional): Pipeline tag filter
- `library` (string, optional): Library filter
- `updatedWithinDays` (number, optional): Only models updated within N days
- `createdWithinDays` (number, optional): Only models created within N days
- `gated` (boolean, optional): Filter by gated status
- `sort` (string, optional): Sort by 'downloads', 'likes', or 'created'
- `limit` (number, optional): Number of results (1-50, default 10)

### sg-search-code

Search for code across open-source repositories using Sourcegraph.

**Parameters:**

- `query` (string): Search query keywords
- `language` (string, optional): Filter results by language
- `limit` (number, optional): Maximum results (max 100)

### ctx7-search-docs

Search library documentation via Context7 — curated, version-aware docs with code examples.

**Parameters:**

- `query` (string): Documentation search query or library name
- `library` (string, optional): Context7 library ID (skips auto-resolve)
- `tokens` (number, optional): Token budget for response (default 4000)

### ctx7-resolve-library

Resolve a library name to Context7 library IDs.

**Parameters:**

- `query` (string): Library name to resolve
