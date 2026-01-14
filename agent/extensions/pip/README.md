# Pip Tools Extension

This extension provides tools to query Python packages using pip. It adds three tools to the pi coding assistant:

## Tools

### pip_search
Search for Python packages on PyPI.

**Parameters:**
- `query` (string): Search query (package name or keyword)
- `limit` (number, optional): Maximum number of results to return (default: 10, max: 50)

**Example:**
```
pip_search(query="requests", limit=5)
```

### pip_show
Show detailed information about an installed Python package.

**Parameters:**
- `package` (string): Name of the package to show information for

**Example:**
```
pip_show(package="requests")
```

### pip_list
List all installed Python packages with their versions.

**Parameters:**
- `format` (string, optional): Output format - "table", "json", or "freeze" (default: "table")
- `outdated` (boolean, optional): Only show outdated packages (default: false)

**Example:**
```
pip_list(format="json", outdated=true)
```

## Installation

The extension is automatically loaded from `~/.pi/agent/extensions/pip-tools/index.ts`.

## Requirements

- Python and pip must be installed and available in PATH
- For `pip_search`, pip version 20.3+ is recommended for JSON output support

## Usage

Once loaded, the tools will be available to the LLM. You can ask questions like:

- "What packages are installed?"
- "Search for packages related to HTTP requests"
- "Show me information about the requests package"
- "Are there any outdated packages?"

The extension handles output truncation for large package lists to avoid overwhelming the context.