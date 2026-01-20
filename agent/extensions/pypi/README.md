# PyPI Extension

This extension provides tools to query Python packages from PyPI. It adds two tools to the pi coding assistant:

## Tools

### search-pypi-packages

Search for Python packages on PyPI.

**Parameters:**

- `query` (string): Search query (package name or keyword)
- `limit` (number, optional): Maximum number of results to return (default: 10, max: 50)

**Example:**

```
search_pypi_packages(query="requests", limit=5)
```

**Note:** Uses PyPI web search and falls back to direct package lookup if needed.

### pypi-package-info

Show detailed information about a Python package from PyPI.

**Parameters:**

- `package` (string): Name of the package to show information for

**Example:**

```
pypi_package_info(package="requests")
```

**Note:** Fetches package info directly from PyPI JSON API (`https://pypi.org/pypi/{package}/json`).

## Installation

The extension is automatically loaded from `~/.pi/agent/extensions/pypi/index.ts`.

## Requirements

No local requirements - uses PyPI API directly.

## Usage

Once loaded, the tools will be available to the LLM. You can ask questions like:

- "Search for packages related to HTTP requests"
- "Show me information about the requests package"
- "What's the latest version of fastapi?"
