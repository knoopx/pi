---
name: eslint
description: Lints JavaScript and TypeScript code, configures rules, and fixes issues automatically. Use when linting code, fixing style issues, configuring eslint.config.js, or enforcing code quality standards.
---

# ESLint

Pluggable linting for JavaScript and TypeScript.

## Quick Start

### Install (Flat Config - ESLint 9+)

```bash
bun add -D eslint @eslint/js typescript-eslint globals
```

### eslint.config.js (Recommended)

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.config.js"],
  },
);
```

### eslint.config.js (Strict TypeScript)

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
);
```

## Running ESLint

```bash
# Run ESLint
eslint .

# Run ESLint with fix
eslint --fix .

# Run on specific file
eslint src/file.ts

# Run with format output
eslint --format json .

# Show diagnostics
eslint --format stylish .

# Run in watch mode
eslint --watch .
```

## Common Plugins

### React

```bash
bun add -D eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh
```

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.rules,
      "react-refresh/only-export-components": "warn",
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
);
```

### Testing

```bash
bun add -D eslint-plugin-jest
```

## Related Skills

- **typescript**: TypeScript configuration and types
- **vitest**: Test setup and configuration
- **bun**: Package management and installation
