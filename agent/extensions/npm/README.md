# NPM Extension

Tools for searching and querying npm packages and their information.

## Installation

No additional installation required. This extension uses the public npm registry API.

## Tools

### search-npm-packages

**Label:** Search NPM Packages

**Description:** Search for packages available on the npm registry.

Use this to:
- Find JavaScript/TypeScript packages
- Discover libraries and frameworks
- Check package descriptions and keywords
- Explore npm ecosystem

Returns matching packages with metadata.

**Parameters:**
- `query` (string): Search query for npm packages
- `size` (number, optional): Number of results (default 10, max 100)

### npm-package-info

**Label:** NPM Package Info

**Description:** Get comprehensive information about an npm package.

Use this to:
- Check package details and versions
- See dependencies and maintainers
- View licensing and repository information
- Evaluate package suitability

Returns detailed package metadata.

**Parameters:**
- `package` (string): npm package name

### npm-package-versions

**Label:** NPM Package Versions

**Description:** List all available versions of an npm package.

Use this to:
- See version history and availability
- Check for latest versions
- Find specific version tags
- Plan version upgrades

Returns all published package versions.

**Parameters:**
- `package` (string): npm package name