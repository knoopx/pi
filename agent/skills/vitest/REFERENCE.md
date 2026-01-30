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

## Testing Anti-Patterns

| Anti-Pattern               | Problem                         | Solution                       |
| -------------------------- | ------------------------------- | ------------------------------ |
| **IceCream Cone**          | More E2E tests than unit tests  | Invert the pyramid             |
| **Flaky Tests**            | Tests randomly fail             | Fix race conditions, use mocks |
| **Slow Tests**             | Test suite takes too long       | Isolate, parallelize, mock I/O |
| **Testing Implementation** | Tests break on refactor         | Test behavior, not internals   |
| **No Assertions**          | Tests without meaningful checks | Add specific assertions        |
| **Test Data Coupling**     | Tests depend on shared state    | Isolate test data              |

### BDD Anti-Patterns

| Anti-Pattern           | Problem                  | Solution                     |
| ---------------------- | ------------------------ | ---------------------------- |
| **UI-focused steps**   | Brittle, hard to read    | Use domain language          |
| **Too many steps**     | Hard to understand       | Split into focused scenarios |
| **Incidental details** | Noise obscures intent    | Include only relevant data   |
| **No clear outcome**   | Can't tell what's tested | End with business assertion  |
| **Coupled scenarios**  | Order-dependent tests    | Make scenarios independent   |
| **Developer jargon**   | Business can't validate  | Use ubiquitous language      |

### Detecting Test Anti-Patterns

```bash
# Find tests without assertions
ast-grep run --pattern 'it($DESC, () => { $$$BODY })' --lang typescript tests/
# Then manually check for missing expect()

# Find slow tests
vitest run --reporter=verbose | grep -E "[0-9]+ms"
```

## Test Organization

### File Structure

```
src/
  users/
    user-service.ts
    user-service.test.ts    # Co-located tests
  orders/
    order-service.ts
    order-service.test.ts

# OR

src/
  users/
    user-service.ts
tests/
  users/
    user-service.test.ts    # Mirrored structure
```

### Naming Tests (BDD Style)

```typescript
// ❌ BAD: Vague names, no context
it("works", () => {});
it("handles error", () => {});
it("test1", () => {});

// ❌ BAD: Missing Given-When-Then structure
describe("UserService", () => {
  it("creates user", () => {});
  it("throws on invalid email", () => {});
});

// ✅ GOOD: Full BDD structure with Given-When-Then
describe("UserService", () => {
  describe("given valid user data", () => {
    describe("when creating a user", () => {
      it("then the user should be persisted with an ID", () => {});
    });
  });

  describe("given an invalid email format", () => {
    describe("when creating a user", () => {
      it("then a ValidationError should be thrown", () => {});
    });
  });
});
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
- Invert the test pyramid: more unit tests, fewer E2E tests
- Keep tests independent and isolated
- Test business logic, not implementation details
- Use meaningful test data, not "test", "foo", "bar"

## Related Skills

- **typescript**: Type safety for tests
- **bun**: Package management and scripting
- **ast-grep**: Pattern matching for refactoring
