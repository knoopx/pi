# Vitest Reference

Advanced configuration options, patterns, and codebase exploration.

## Configuration Options

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./setup.ts"],
    testTimeout: 10000,
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      reporter: ["text", "json"],
      exclude: ["node_modules/", "src/test/"],
    },
  },
});
```

## Projects

```typescript
export default defineConfig({
  test: {
    projects: [
      {
        name: "unit",
        test: { include: ["**/*.test.ts"] },
      },
      {
        name: "integration",
        test: { include: ["**/*.spec.ts"] },
      },
    ],
  },
});
```

## Browser Testing

```typescript
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: "chromium",
      provider: "playwright",
    },
  },
});
```

## Benchmarking

```typescript
import { bench, describe } from "vitest";

describe("Sorting Performance", () => {
  describe("given an array of 1000 numbers", () => {
    const numbers = Array.from({ length: 1000 }, () => Math.random());

    bench("when using native sort", () => {
      [...numbers].sort((a, b) => a - b);
    });

    bench("when using custom quicksort", () => {
      quicksort([...numbers]);
    });
  });
});
```

## Type Checking

```bash
vitest typecheck              # Check types alongside tests
vitest typecheck --run        # Single run
```

## Tips

- Never use `globals: true`, always import from vitest
- `bun vitest run` in CI for single run
- `--coverage` generates coverage reports
- Mock external dependencies with `vi.mock()`
- Use `--reporter=verbose` for detailed test output
- Browser mode for real browser testing: `--browser`
- Use `vitest bench` for performance testing
- Structure tests with Given-When-Then for clarity
- Use `bun vitest related` for finding related tests

## Related Skills

- **swe**: Testing anti-patterns, BDD patterns, test organization
- **typescript**: Type safety for tests
- **bun**: Package management and scripting
