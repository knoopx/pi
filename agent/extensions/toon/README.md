# Toon Extension

Automatically converts JSON tool responses to Toon format for better readability.

## Description

The Toon extension intercepts tool results and converts JSON content to Toon format, which is more human-readable than traditional JSON. This makes API responses and structured data easier to read and understand.

## Features

- **Automatic Conversion**: Converts JSON responses from tools to Toon format
- **Smart Filtering**: Skips conversion for package.json files
- **Transparent**: Only affects display, preserves original data in details

## Installation

Requires the `@toon-format/toon` package. Install via:

```bash
bun add @toon-format/toon
```

Or the package.json shows the dependency.

## Usage

The extension works automatically:

1. When a tool returns JSON content in its result
2. The extension parses the JSON
3. Converts it to Toon format for display
4. Preserves original data in `details` field

## Example

**Before (JSON):**
```json
{"name": "example", "data": {"items": [1, 2, 3]}}
```

**After (Toon):**
```
name: example
data:
  items:
    - 1
    - 2
    - 3
```

## Requirements

- `@toon-format/toon` package must be installed
- Tool responses must contain valid JSON as text content
- Only single text content blocks are processed

## Configuration

- Automatically skips files matching `/(^|\/)package\.json$/i` pattern
- No additional configuration needed