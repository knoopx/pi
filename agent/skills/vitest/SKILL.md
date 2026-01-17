name: vitest
description: |
  Manage JavaScript/TypeScript testing projects with Vitest (test execution, configuration, mocking, coverage, and debugging).

  Use this to:
  - Run tests for JavaScript and TypeScript projects
  - Configure test environments and mocking
  - Generate test coverage reports
  - Debug tests with built-in tools
---

# Installation

Install Vitest as a dev dependency:

```bash
bun add -D vitest
```

Requirements: Vite >=v6.0.0 and Node >=v20.0.0

# Writing Tests

Tests must contain `.test.` or `.spec.` in their file name.

Example:

sum.js

```js
export function sum(a, b) {
  return a + b;
}
```

sum.test.js

```js
import { expect, test } from "vitest";
import { sum } from "./sum.js";

test("adds 1 + 2 to equal 3", () => {
  expect(sum(1, 2)).toBe(3);
});
```

Add to package.json scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "coverage": "vitest run --coverage"
  }
}
```

Run tests with `bun run test`, etc.

# Configuration

Vitest shares config with Vite. Use `vitest.config.ts` or add `test` property to `vite.config.ts`.

Example vitest.config.ts:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // or 'jsdom', 'happy-dom'
    globals: true, // use global test functions
    setupFiles: ["./setup.ts"],
  },
});
```

For Vite users, add to vite.config.ts:

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  // ... other config
  test: {
    // test options
  },
});
```

# Command Line Interface

- `bun run vitest`: Run tests in watch mode
- `bun run vitest run`: Run tests once
- `bun run vitest run --coverage`: Run with coverage
- `bun run vitest --config <file>`: Specify config file
- `bun run vitest --help`: Show all options

# Mocking

Use `vi.mock()` to mock modules:

```js
import { vi } from "vitest";

vi.mock("./module.js", () => ({
  functionName: vi.fn(),
}));
```

# Coverage

Enable coverage with `--coverage` flag or config:

```ts
export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});
```

# Debugging

Use `--inspect` or `--inspect-brk` for Node.js debugging.

In VS Code, add launch config for debugging tests.

# Projects Support

Define multiple projects in config for different environments or setups.

```ts
export default defineConfig({
  test: {
    projects: [
      "packages/*",
      {
        test: {
          name: "e2e",
          environment: "jsdom",
        },
      },
    ],
  },
});
```

## Related Skills

- **bun**: Use Bun as the runtime for running tests with Vitest, or manage dependencies in testing projects.
- **typescript**: Ensure type safety in your tests by following TypeScript best practices when writing test code with Vitest.

## Related Tools

- **lsp**: Query language server for definitions, references, types, symbols, diagnostics, rename, and code actions.
