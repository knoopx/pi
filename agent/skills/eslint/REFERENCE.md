# ESLint Reference

Detailed configuration options, rules, and migration guides.

## Configuration Presets

### Recommended Preset

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

### Strict Preset

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

## Rule Configuration

### TypeScript Rules

```javascript
{
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-namespace": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/no-restricted-syntax": ["warn"],
    "@typescript-eslint/prefer-as-type": "off",
    "@typescript-eslint/prefer-namespace": "off",
    "@typescript-eslint/prefer-readonly-parameter-types": "off",
    "@typescript-eslint/prefer-readonly-property": "off",
    "@typescript-eslint/prefer-const": "warn",
    "@typescript-eslint/prefer-nullish-coalescing": "warn",
    "@typescript-eslint/consistent-type-assertions": "warn",
    "@typescript-eslint/consistent-type-definitions": "error",
    "@typescript-eslint/consistent-type-imports": ["warn", {
      prefer: "type-imports",
      fixStyle: "separate-type-imports"
    }],
    "@typescript-eslint/consistent-indexed-object-style": "off",
    "@typescript-eslint/consistent-type-imports-enforce-fix": "off",
    "@typescript-eslint/no-import-type-side-effects": "error",
    "@typescript-eslint/no-import-type-side-effects": "error",
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": "error",
    "@typescript-eslint/no-unnecessary-qualifier": "error",
    "@typescript-eslint/no-unnecessary-template-literal-type": "error",
    "@typescript-eslint/no-unnecessary-type-arguments": "off",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-unsafe-type-assertion": "error",
    "@typescript-eslint/no-unnecessary-condition": "error",
    "@typescript-eslint/no-unnecessary-boolean-literal": "warn",
    "@typescript-eslint/no-unnecessary-condition": "error",
    "@typescript-eslint/no-unnecessary-qualifier": "error",
    "@typescript-eslint/no-unnecessary-template-literal-type": "error",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/no-unnecessary-type-arguments": "off",
    "@typescript-eslint/no-unnecessary-type-assertion": "error",
    "@typescript-eslint/no-unnecessary-void-return": "error",
    "@typescript-eslint/prefer-as-const": "warn",
    "@typescript-eslint/prefer-enum-initializers": "off",
    "@typescript-eslint/prefer-literal-enum-member": "off",
    "@typescript-eslint/prefer-namespace": "off",
    "@typescript-eslint/prefer-readonly-parameter-types": "off",
    "@typescript-eslint/prefer-readonly-property": "off",
    "@typescript-eslint/prefer-const": "warn",
    "@typescript-eslint/prefer-nullish-coalescing": "warn",
    "@typescript-eslint/strict-boolean-expression": "off",
    "@typescript-eslint/strict-boolean-expression": {
      allow: [],
      allowMetaPropertyType: false
    },
    "@typescript-eslint/strict-boolean-expression": "off",
    "@typescript-eslint/strict-boolean-expression": {
      allow: [],
      allowMetaPropertyType: false
    },
  }
}
```

### JavaScript Rules

```javascript
{
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-alert": "error",
    "no-var": "warn",
    "no-unused-vars": "off",
    "no-undef": "error",
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "no-implicit-coercion": "error",
    "no-magic-numbers": "warn",
    "no-throw-literal": "error",
    "no-unsafe-finally": "error",
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
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  },
);
```

## Ignoring Files

### Ignore Patterns

```javascript
{
  ignores: [
    "dist/",
    "node_modules/",
    "*.config.js",
    "*.config.ts",
    "coverage/",
    ".next/",
    "build/",
    "**/*.test.ts",
    "**/*.spec.ts",
  ];
}
```

### Ignore Patterns in package.json

```json
{
  "scripts": {
    "lint": "eslint . --ignore-path .eslintignore"
  }
}
```

## Migration from Legacy Config

### From .eslintrc.json

```javascript
// Before: .eslintrc.json
{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "parserOptions": {
    "project": "./tsconfig.json"
  }
}

// After: eslint.config.js
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

### From .eslintrc.js

```javascript
// Before: .eslintrc.js
module.exports = {
  extends: ["eslint:recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};

// After: eslint.config.js
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

## CI Integration

### GitHub Actions

```yaml
# .github/workflows/lint.yml
name: Lint

on: [push, pull_request]

jobs:
  eslint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: bun
      - run: bun install
      - run: bun run lint
```

### Git Hooks

```bash
# Install husky
bun add -D husky

# Add pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env bash
bun lint
EOF

chmod +x .husky/pre-commit
```

### Azure DevOps

```yaml
# azure-pipelines.yml
jobs:
  - job: Lint
    displayName: "Lint Code"
    steps:
      - task: UseNode@1
        displayName: "Use Node.js"
        inputs:
          version: 20
      - script: bun install
        displayName: "Install Dependencies"
      - script: bun run lint
        displayName: "Run ESLint"
```
