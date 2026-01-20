---
name: eslint
description: Lint JavaScript and TypeScript code, configure rules, fix issues automatically, and set up ESLint in projects. Use when linting code, fixing style issues, configuring eslint.config.js, or enforcing code quality standards.
---

# ESLint Cheatsheet

Pluggable linting for JavaScript and TypeScript.

## Contents

- [Setup](#setup)
- [Running ESLint](#running-eslint)
- [Configuration Presets](#configuration-presets)
- [Common Plugins](#common-plugins)
- [Rule Configuration](#rule-configuration)
- [File-Specific Configuration](#file-specific-configuration)
- [Ignoring Files](#ignoring-files)
- [Migration from Legacy Config](#migration-from-legacy-config)
- [CI Integration](#ci-integration)

## Setup

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
  }
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
  }
);
```

### package.json Scripts

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

## Running ESLint

```bash
eslint .                     # Lint all files
eslint src/                  # Lint specific directory
eslint file.ts               # Lint single file
eslint . --fix               # Auto-fix issues
eslint . --fix-dry-run       # Preview fixes without applying
eslint . --max-warnings 0    # Fail on warnings
eslint . --cache             # Use cache for faster runs
eslint . --format stylish    # Output format (stylish, json, compact)
eslint . --quiet             # Report errors only
eslint . --debug             # Debug configuration
eslint --print-config file.ts  # Show config for a file
eslint --inspect-config      # Open config inspector in browser
```

## Configuration Presets

### JavaScript Only

```javascript
import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
```

### TypeScript Recommended

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
```

### TypeScript Strict (Type-Checked)

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

## Common Plugins

### Install Popular Plugins

```bash
# React
bun add -D eslint-plugin-react eslint-plugin-react-hooks

# Import sorting
bun add -D eslint-plugin-import

# Prettier integration
bun add -D eslint-config-prettier eslint-plugin-prettier

# Security
bun add -D eslint-plugin-security

# Node.js
bun add -D eslint-plugin-n

# JSDoc
bun add -D eslint-plugin-jsdoc
```

### React Configuration

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
  },
);
```

### Prettier Integration

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier, // Must be last to disable conflicting rules
);
```

## Rule Configuration

### Rule Severity

```javascript
{
  rules: {
    "no-unused-vars": "off",      // 0 - disable
    "no-console": "warn",          // 1 - warning
    "no-debugger": "error",        // 2 - error
  }
}
```

### Rule with Options

```javascript
{
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    }],
    "no-restricted-imports": ["error", {
      patterns: ["../../../*"],
    }],
  }
}
```

## Essential Rules

### TypeScript Recommended Rules

```javascript
{
  rules: {
    // Prevent unused variables
    "@typescript-eslint/no-unused-vars": ["error", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    }],
    // Prevent explicit any
    "@typescript-eslint/no-explicit-any": "warn",
    // Require return types on functions
    "@typescript-eslint/explicit-function-return-type": "off",
    // Require explicit accessibility modifiers
    "@typescript-eslint/explicit-member-accessibility": "off",
    // Prevent empty functions
    "@typescript-eslint/no-empty-function": "warn",
    // Prefer nullish coalescing
    "@typescript-eslint/prefer-nullish-coalescing": "warn",
    // Prefer optional chaining
    "@typescript-eslint/prefer-optional-chain": "warn",
  }
}
```

### Code Quality Rules

```javascript
{
  rules: {
    "no-console": "warn",
    "no-debugger": "error",
    "no-duplicate-imports": "error",
    "no-template-curly-in-string": "warn",
    "prefer-const": "error",
    "prefer-template": "warn",
    "eqeqeq": ["error", "always"],
    "curly": ["error", "all"],
  }
}
```

## File-Specific Configuration

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "warn",
    },
  },
  // Test files
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: { ...globals.jest },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Config files
  {
    files: ["*.config.js", "*.config.ts"],
    rules: {
      "no-console": "off",
    },
  },
);
```

## Ignoring Files

### In Config

```javascript
export default [
  {
    ignores: [
      "dist/",
      "build/",
      "node_modules/",
      "*.min.js",
      "coverage/",
      ".next/",
    ],
  },
  // ... other configs
];
```

### Inline Disable

```javascript
// eslint-disable-next-line no-console
console.log("debug");

/* eslint-disable @typescript-eslint/no-explicit-any */
const data: any = {};
/* eslint-enable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line -- explanation why
```

## Migration from Legacy Config

### From .eslintrc to eslint.config.js

```bash
# Use migration tool
npx @eslint/migrate-config .eslintrc.json
```

### Key Differences

| Legacy (.eslintrc) | Flat Config (eslint.config.js) |
|--------------------|-------------------------------|
| `extends` | Import and spread configs |
| `plugins` | Object with plugin imports |
| `env` | `languageOptions.globals` |
| `parser` | `languageOptions.parser` |
| `parserOptions` | `languageOptions.parserOptions` |
| `.eslintignore` | `ignores` array in config |

## CI Integration

### GitHub Actions

```yaml
- name: Lint
  run: |
    bun install
    bun run lint
```

### Pre-commit Hook (with Husky)

```bash
bun add -D husky lint-staged
npx husky init
echo "bunx lint-staged" > .husky/pre-commit
```

```json
{
  "lint-staged": {
    "*.{js,ts,tsx}": ["eslint --fix", "prettier --write"]
  }
}
```

## Debugging

```bash
# Check which config applies to a file
eslint --print-config src/index.ts

# Debug rule resolution
eslint --debug src/index.ts

# Interactive config inspector
eslint --inspect-config

# Check installed plugins
eslint --env-info
```

## Tips

- Always use flat config (eslint.config.js) for ESLint 9+
- Put `prettier` config last to disable conflicting rules
- Use `--cache` in CI for faster runs
- Prefer recommended presets over manual rule configuration
- Use `typescript-eslint` helper for TypeScript projects
- Run `--fix` to auto-fix many issues
- Use `--max-warnings 0` to treat warnings as errors in CI
- Enable type-checked rules for stricter TypeScript linting
