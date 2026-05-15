---
name: vitest
description: "Writes and runs tests, configures test environments, mocks dependencies, and generates coverage reports. Use when setting up vitest.config.ts, writing test suites, mocking modules, or measuring code coverage."
token_cost: 180
keywords:
  ["vitest", "test", "mock", "coverage", "suite", "assert", "spec", "unit"]
---

# Vitest

Fast unit testing powered by Vite. Write tests that run in Node or browser environments.

## Setup & Config

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // or 'jsdom', 'happy-dom'
    globals: true, // use global test functions
    setupFiles: ["./setup.ts"],
    include: ["**/*.test.ts", "**/*.spec.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "test"],
    },
  },
});
```

## Running Tests

```bash
bun vitest run              # Run all tests
bun vitest                  # Watch mode (development)
bun vitest run src/utils.test.ts   # Specific file
bun vitest run -t "should validate"  # Match pattern
bun vitest run --coverage         # With coverage report
bun vitest related src/file.ts    # Tests related to changed files
```

## Writing Tests

Use Given-When-Then structure with nested `describe` blocks for clarity:

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("Calculator", () => {
  describe("given two positive numbers", () => {
    const a = 5;
    const b = 3;

    describe("when adding them", () => {
      it("then the result should be their sum", () => {
        expect(a + b).toBe(8);
      });
    });
  });
});
```

## Test Quality Guidelines

- **Independent**: no shared state between tests
- **Deterministic**: same result every run
- **Focused**: one assertion focus per test
- **Fast**: unit tests under 100ms
- **Clear**: minimal setup, obvious assertions

Test business logic, edge cases, error handling, and public API contracts. Skip trivial getters/setters, third-party libraries, and UI layout.

## Mocking

- Module mocking: `vi.mock()` for external dependencies
- Filesystem mocking: in-memory filesystem with memfs
- Request mocking: intercept HTTP requests

See the references/ directory for detailed mocking patterns.
