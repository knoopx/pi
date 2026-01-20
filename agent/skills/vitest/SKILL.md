---
name: vitest
description: Write and run tests, configure test environments, mock dependencies, and generate coverage reports. Use when setting up vitest.config.ts, writing test suites, mocking modules, or measuring code coverage.
---

# Vitest Cheatsheet

Fast unit testing framework powered by Vite.

## Contents

- [Setup](#setup)
- [Running Tests](#running-tests)
- [BDD Test Structure](#bdd-test-structure)
- [Assertions](#assertions)
- [Mocking](#mocking-bdd-style)
- [Module Mocking](#module-mocking-bdd-style)
- [Hooks](#hooks-bdd-style)
- [Coverage](#coverage)
- [Configuration Options](#configuration-options)
- [Benchmarking](#benchmarking)

## Setup

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "coverage": "vitest run --coverage"
  }
}
```

### Config (vitest.config.ts)

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", // 'jsdom', 'happy-dom'
    globals: true,       // use global test functions
    setupFiles: ["./setup.ts"],
  },
});
```

## Running Tests

```bash
vitest run           # Run once
vitest run --coverage # With coverage
vitest --reporter=verbose  # Detailed output
vitest bench         # Run benchmarks
vitest typecheck     # Run type checking
vitest related src/file.ts  # Run tests related to file

# Watch mode / Web UI (use tmux for background)
tmux new -d -s vitest 'vitest'
tmux new -d -s vitest-ui 'vitest --ui'
```

## BDD Test Structure

Write tests using Given-When-Then style with nested `describe` blocks:

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

    describe("when subtracting them", () => {
      it("then the result should be the difference", () => {
        expect(a - b).toBe(2);
      });
    });
  });

  describe("given a division by zero", () => {
    describe("when dividing", () => {
      it("then it should return Infinity", () => {
        expect(1 / 0).toBe(Infinity);
      });
    });
  });
});
```

## Assertions

```typescript
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toContain(item);
expect(value).toHaveLength(length);
expect(value).toThrow(error);
```

## Async Tests (BDD Style)

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("UserAPI", () => {
  describe("given a valid user ID", () => {
    const userId = 1;

    describe("when fetching the user", () => {
      it("then the user data should be returned", async () => {
        const user = await fetchUser(userId);

        expect(user).toBeDefined();
        expect(user.id).toBe(userId);
      });
    });
  });

  describe("given an invalid user ID", () => {
    const userId = -1;

    describe("when fetching the user", () => {
      it("then it should throw a NotFoundError", async () => {
        await expect(fetchUser(userId)).rejects.toThrow("User not found");
      });
    });
  });
});
```

## Mocking (BDD Style)

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

describe("OrderService", () => {
  describe("given a mocked payment gateway", () => {
    const mockPaymentGateway = {
      charge: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("when processing a valid order", () => {
      beforeEach(() => {
        mockPaymentGateway.charge.mockResolvedValue({ success: true });
      });

      it("then the payment should be charged", async () => {
        const orderService = new OrderService(mockPaymentGateway);
        await orderService.process({ amount: 100 });

        expect(mockPaymentGateway.charge).toHaveBeenCalledWith(100);
      });

      it("then the order should be marked as paid", async () => {
        const orderService = new OrderService(mockPaymentGateway);
        const result = await orderService.process({ amount: 100 });

        expect(result.status).toBe("paid");
      });
    });

    describe("when payment fails", () => {
      beforeEach(() => {
        mockPaymentGateway.charge.mockRejectedValue(new Error("Payment declined"));
      });

      it("then the order should be marked as failed", async () => {
        const orderService = new OrderService(mockPaymentGateway);

        await expect(orderService.process({ amount: 100 })).rejects.toThrow("Payment declined");
      });
    });
  });
});
```

## Module Mocking (BDD Style)

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("./email-service", () => ({
  sendEmail: vi.fn(),
}));

import { sendEmail } from "./email-service";
import { UserService } from "./user-service";

describe("UserService", () => {
  describe("given a mocked email service", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    describe("when a user registers successfully", () => {
      it("then a welcome email should be sent", async () => {
        const userService = new UserService();
        await userService.register({ email: "alice@example.com", name: "Alice" });

        expect(sendEmail).toHaveBeenCalledWith(
          "alice@example.com",
          expect.stringContaining("Welcome")
        );
      });
    });

    describe("when registration fails due to invalid email", () => {
      it("then no email should be sent", async () => {
        const userService = new UserService();

        await expect(
          userService.register({ email: "invalid", name: "Bob" })
        ).rejects.toThrow();

        expect(sendEmail).not.toHaveBeenCalled();
      });
    });
  });
});
```

## Spying (BDD Style)

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";

describe("Logger", () => {
  describe("given a console spy", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    describe("when logging a message", () => {
      it("then the message should be written to console", () => {
        const logger = new Logger();
        logger.info("Hello, World!");

        expect(consoleSpy).toHaveBeenCalledWith("[INFO]", "Hello, World!");
      });
    });
  });
});
```

## Hooks (BDD Style)

```typescript
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";

describe("Database Operations", () => {
  describe("given a database connection", () => {
    let db: Database;

    beforeAll(async () => {
      db = await Database.connect(":memory:");
    });

    afterAll(async () => {
      await db.close();
    });

    describe("given an empty users table", () => {
      beforeEach(async () => {
        await db.exec("DELETE FROM users");
      });

      describe("when inserting a user", () => {
        it("then the user count should be 1", async () => {
          await db.insert("users", { name: "Alice" });

          const count = await db.count("users");
          expect(count).toBe(1);
        });
      });

      describe("when querying users", () => {
        it("then the result should be empty", async () => {
          const users = await db.query("SELECT * FROM users");

          expect(users).toHaveLength(0);
        });
      });
    });
  });
});
```

## Error Testing (BDD Style)

```typescript
import { describe, it, expect } from "vitest";

describe("Validator", () => {
  describe("given an empty string", () => {
    const input = "";

    describe("when validating as required field", () => {
      it("then it should throw a ValidationError", () => {
        expect(() => validateRequired(input)).toThrow("Field is required");
      });

      it("then the error should be a ValidationError instance", () => {
        expect(() => validateRequired(input)).toThrow(ValidationError);
      });
    });
  });

  describe("given a valid email", () => {
    const email = "test@example.com";

    describe("when validating email format", () => {
      it("then it should not throw", () => {
        expect(() => validateEmail(email)).not.toThrow();
      });
    });
  });

  describe("given an invalid email", () => {
    const email = "not-an-email";

    describe("when validating email format", () => {
      it("then it should throw with descriptive message", () => {
        expect(() => validateEmail(email)).toThrow(/invalid email format/i);
      });
    });
  });
});
```

## Coverage

```typescript
export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules", "test"],
    },
  },
});
```

## Environments

```typescript
// Node.js (default)
test: { environment: "node" }

// Browser
test: { environment: "jsdom" }

// Custom
test: {
  environment: "jsdom",
  setupFiles: ["./setup.js"],
}
```

## Configuration Options

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
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

- Use `globals: true` to avoid importing test functions
- `vitest run` in CI for single run
- `--coverage` generates coverage reports
- Mock external dependencies with `vi.mock()`
- Use `--reporter=verbose` for detailed test output
- Browser mode for real browser testing: `--browser`
- Use tmux for watch mode: `tmux new -d -s vitest 'vitest'`
- Use `vitest bench` for performance testing
- Structure tests with Given-When-Then for clarity
