# Testing Phase

Guidelines for test pyramid, BDD, test quality, and avoiding test anti-patterns.

---

## Test Pyramid

```
        /\
       /  \     E2E Tests (few)
      /----\    - Critical user journeys
     /      \   - Slow, expensive
    /--------\
   /          \ Integration Tests (some)
  /------------\- Component interactions
 /              \- Database, APIs
/----------------\
   Unit Tests (many)
   - Fast, isolated
   - Business logic
```

---

## What to Test

```
✅ TEST                              ❌ SKIP
─────────────────────────────────────────────────────
Business logic                       Framework code
Edge cases and boundaries            Trivial getters/setters
Error handling paths                 Third-party libraries
Public API contracts                 Private implementation details
Integration points                   UI layout (use visual tests)
Security-sensitive code              Configuration files
```

---

## Test Quality Checklist

- [ ] Tests are independent and isolated
- [ ] Tests are deterministic (no flakiness)
- [ ] Test names describe behavior being tested
- [ ] Each test has a single reason to fail
- [ ] Tests run fast (< 100ms for unit tests)
- [ ] Tests use meaningful assertions
- [ ] Setup/teardown is minimal and clear

---

## Running Tests

### TypeScript/JavaScript with Vitest

```bash
# Run all tests
vitest run

# Watch mode (development)
vitest

# Run specific test file
vitest run src/utils.test.ts

# Run tests matching pattern
vitest run -t "should validate"

# With coverage
vitest run --coverage

# Verbose output
vitest run --reporter=verbose

# Run tests related to changed files
vitest related src/file.ts
```

### Python with pytest

```bash
# Run all tests
uv run pytest

# Verbose mode
uv run pytest -v

# Run specific test file
uv run pytest tests/test_main.py

# Run specific test function
uv run pytest tests/test_main.py::test_greet

# Run tests matching pattern
uv run pytest -k "test_add or test_subtract"

# With coverage
uv run pytest --cov=src --cov-report=term-missing

# Stop on first failure
uv run pytest -x
```

### Using Bun Test

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# Run specific test
bun test -t "pattern"

# With coverage
bun test --coverage
```

---

## Behavior-Driven Development (BDD)

BDD bridges the gap between business requirements and technical implementation by using a shared language that all stakeholders understand.

```
Business Need → Executable Specification → Working Software
```

### Structure: Given-When-Then

Organize tests around three phases:

| Phase     | Purpose                      | Example                                   |
| --------- | ---------------------------- | ----------------------------------------- |
| **Given** | Preconditions, initial state | "a registered user exists"                |
| **When**  | Action being performed       | "the user logs in with valid credentials" |
| **Then**  | Expected outcome             | "the user should see their dashboard"     |

### Writing Good Scenarios

```
❌ BAD: Implementation details, unclear intent
─────────────────────────────────────────────────────
"open browser, navigate to /login, find element with
id email, type test@test.com, click submit button"

✅ GOOD: Business language, clear intent
─────────────────────────────────────────────────────
Given a registered user exists
When the user logs in with valid credentials
Then the user should see their dashboard
```

### BDD Best Practices

```
✅ DO                                ❌ DON'T
─────────────────────────────────────────────────────
Write from user's perspective        Use technical jargon
One behavior per scenario            Test multiple things
Use declarative style                Include implementation details
Keep scenarios independent           Share state between scenarios
Use meaningful data                  Use "test", "foo", "bar"
Focus on business outcomes           Focus on UI interactions
```

### Three Amigos

BDD works best when three perspectives collaborate:

1. **Business/Product**: What problem are we solving?
2. **Development**: How will we build it?
3. **Testing**: What could go wrong?

**Before writing code:**

- Discuss requirements together
- Write scenarios collaboratively
- Agree on acceptance criteria
- Identify edge cases early

---

## Writing BDD Tests

### Basic BDD Structure (TypeScript/Vitest)

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("UserService", () => {
  describe("given a new user with valid data", () => {
    const userData = { name: "Alice", email: "alice@example.com" };

    describe("when creating the user", () => {
      it("then the user should be created with an ID", async () => {
        const userService = new UserService();
        const user = await userService.create(userData);

        expect(user.id).toBeDefined();
        expect(user.name).toBe("Alice");
        expect(user.email).toBe("alice@example.com");
      });
    });
  });

  describe("given user data with an invalid email", () => {
    const userData = { name: "Bob", email: "invalid-email" };

    describe("when creating the user", () => {
      it("then it should reject with a validation error", async () => {
        const userService = new UserService();

        await expect(userService.create(userData)).rejects.toThrow(
          "Invalid email",
        );
      });
    });
  });
});
```

### BDD with Shared Context

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("User Login", () => {
  describe("given a registered user exists", () => {
    let user: User;

    beforeEach(async () => {
      user = await createUser({
        email: "alice@example.com",
        password: "secure123",
      });
    });

    describe("when the user logs in with valid credentials", () => {
      let session: Session;

      beforeEach(async () => {
        session = await login(user.email, "secure123");
      });

      it("then a valid session should be created", () => {
        expect(session.token).toBeDefined();
        expect(session.userId).toBe(user.id);
      });

      it("then the user should be able to access their dashboard", async () => {
        const dashboard = await getDashboard(session);

        expect(dashboard.userId).toBe(user.id);
        expect(dashboard.welcomeMessage).toContain(user.name);
      });
    });

    describe("when the user logs in with wrong password", () => {
      it("then login should fail with authentication error", async () => {
        await expect(login(user.email, "wrongpassword")).rejects.toThrow(
          "Invalid credentials",
        );
      });
    });

    describe("when the user logs in with non-existent email", () => {
      it("then login should fail with authentication error", async () => {
        await expect(login("unknown@example.com", "secure123")).rejects.toThrow(
          "Invalid credentials",
        );
      });
    });
  });

  describe("given no user is registered", () => {
    describe("when attempting to login", () => {
      it("then login should fail with authentication error", async () => {
        await expect(
          login("nobody@example.com", "anypassword"),
        ).rejects.toThrow("Invalid credentials");
      });
    });
  });
});
```

### BDD with Mocked Dependencies

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";
import { UserService } from "./user-service";
import { EmailService } from "./email-service";

vi.mock("./email-service", () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(true),
  })),
}));

describe("User Registration", () => {
  describe("given a valid email service is configured", () => {
    let emailService: EmailService;
    let userService: UserService;

    beforeEach(() => {
      emailService = new EmailService();
      userService = new UserService(emailService);
    });

    describe("when a new user registers successfully", () => {
      let user: User;

      beforeEach(async () => {
        user = await userService.create({
          name: "Alice",
          email: "alice@example.com",
        });
      });

      it("then a welcome email should be sent", () => {
        expect(emailService.send).toHaveBeenCalledWith(
          "alice@example.com",
          expect.stringContaining("Welcome"),
        );
      });

      it("then the email should be sent exactly once", () => {
        expect(emailService.send).toHaveBeenCalledTimes(1);
      });
    });

    describe("when registration fails due to invalid data", () => {
      it("then no email should be sent", async () => {
        await expect(
          userService.create({ name: "", email: "invalid" }),
        ).rejects.toThrow();

        expect(emailService.send).not.toHaveBeenCalled();
      });
    });
  });
});
```

### BDD Error Handling Tests

```typescript
describe("User Processing", () => {
  describe("given a null user input", () => {
    describe("when processing the user", () => {
      it("then it should throw a validation error", () => {
        expect(() => processUser(null)).toThrow("User cannot be null");
      });
    });
  });

  describe("given an invalid user ID", () => {
    describe("when fetching the user", () => {
      it("then it should throw a ValidationError", async () => {
        await expect(fetchUser(-1)).rejects.toBeInstanceOf(ValidationError);
      });

      it("then the error should include the invalid ID", async () => {
        await expect(fetchUser(-1)).rejects.toThrow(/invalid user id.*-1/i);
      });
    });
  });

  describe("given a user that does not exist", () => {
    describe("when fetching the user by ID", () => {
      it("then it should throw a NotFoundError", async () => {
        await expect(fetchUser(99999)).rejects.toBeInstanceOf(NotFoundError);
      });
    });
  });
});
```

### BDD with Python (pytest)

```python
"""Tests for user service following BDD style."""

import pytest
from my_project.user_service import UserService, ValidationError


class TestUserCreation:
    """User creation scenarios."""

    class TestGivenValidUserData:
        """Given valid user data."""

        @pytest.fixture
        def user_data(self):
            return {"name": "Alice", "email": "alice@example.com"}

        @pytest.fixture
        def user_service(self):
            return UserService()

        class TestWhenCreatingUser:
            """When creating the user."""

            def test_then_user_should_be_created_with_id(self, user_service, user_data):
                """Then the user should be created with an ID."""
                user = user_service.create(user_data)

                assert user.id is not None
                assert user.name == "Alice"
                assert user.email == "alice@example.com"

    class TestGivenInvalidEmail:
        """Given user data with invalid email."""

        @pytest.fixture
        def user_data(self):
            return {"name": "Bob", "email": "invalid-email"}

        @pytest.fixture
        def user_service(self):
            return UserService()

        class TestWhenCreatingUser:
            """When creating the user."""

            def test_then_validation_error_should_be_raised(self, user_service, user_data):
                """Then a validation error should be raised."""
                with pytest.raises(ValidationError, match="Invalid email"):
                    user_service.create(user_data)


class TestUserLogin:
    """User login scenarios."""

    class TestGivenRegisteredUser:
        """Given a registered user exists."""

        @pytest.fixture
        def registered_user(self, user_service):
            return user_service.create({
                "email": "alice@example.com",
                "password": "secure123"
            })

        @pytest.fixture
        def user_service(self):
            return UserService()

        class TestWhenLoggingInWithValidCredentials:
            """When the user logs in with valid credentials."""

            def test_then_session_should_be_created(self, user_service, registered_user):
                """Then a valid session should be created."""
                session = user_service.login(
                    registered_user.email,
                    "secure123"
                )

                assert session.token is not None
                assert session.user_id == registered_user.id

        class TestWhenLoggingInWithWrongPassword:
            """When the user logs in with wrong password."""

            def test_then_authentication_should_fail(self, user_service, registered_user):
                """Then authentication should fail."""
                with pytest.raises(AuthenticationError, match="Invalid credentials"):
                    user_service.login(registered_user.email, "wrongpassword")
```

### BDD with Parametrized Tests

```typescript
describe("Order Discount Calculation", () => {
  describe("given different order totals", () => {
    const testCases = [
      { orderTotal: 50, expectedDiscount: 0, scenario: "order under $100" },
      { orderTotal: 100, expectedDiscount: 10, scenario: "order exactly $100" },
      {
        orderTotal: 250,
        expectedDiscount: 25,
        scenario: "order between $100-$500",
      },
      { orderTotal: 500, expectedDiscount: 75, scenario: "order exactly $500" },
      { orderTotal: 1000, expectedDiscount: 150, scenario: "order over $500" },
    ];

    testCases.forEach(({ orderTotal, expectedDiscount, scenario }) => {
      describe(`given an ${scenario} ($${orderTotal})`, () => {
        describe("when calculating the discount", () => {
          it(`then the discount should be $${expectedDiscount}`, () => {
            const discount = calculateDiscount(orderTotal);
            expect(discount).toBe(expectedDiscount);
          });
        });
      });
    });
  });
});
```

```python
"""Parametrized BDD tests in Python."""

import pytest


class TestOrderDiscount:
    """Order discount calculation scenarios."""

    @pytest.mark.parametrize(
        "order_total,expected_discount,scenario",
        [
            (50, 0, "order under $100"),
            (100, 10, "order exactly $100"),
            (250, 25, "order between $100-$500"),
            (500, 75, "order exactly $500"),
            (1000, 150, "order over $500"),
        ],
    )
    def test_discount_calculation(self, order_total, expected_discount, scenario):
        """
        Given an {scenario} (${order_total})
        When calculating the discount
        Then the discount should be ${expected_discount}.
        """
        discount = calculate_discount(order_total)
        assert discount == expected_discount
```

---

## Finding Untested Code

### Coverage Reports

```bash
# TypeScript/JavaScript
vitest run --coverage
bun test --coverage

# Python
uv run pytest --cov=src --cov-report=html tests/
```

### Using codemapper

```bash
# Find tests for a symbol
cm tests authenticate . --format ai

# Find untested symbols
cm untested . --format ai

# What production code does a test touch
cm test-deps ./tests/test_auth.py --format ai
```

### Finding Related Tests

```bash
# Run tests related to changed files
vitest related src/changed-file.ts

# Find tests that cover a function
cm tests functionName . --format ai
```

---

## Testing Anti-Patterns

| Anti-Pattern               | Problem                         | Solution                       |
| -------------------------- | ------------------------------- | ------------------------------ |
| **Ice Cream Cone**         | More E2E tests than unit tests  | Invert the pyramid             |
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

# Find tests with too many assertions (testing multiple things)
# Review tests manually for single responsibility

# Find slow tests
vitest run --reporter=verbose | grep -E "[0-9]+ms"
```

---

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

---

## Test Configuration

### Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts", "**/*.spec.ts"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["node_modules/", "**/*.test.ts"],
    },
    testTimeout: 5000,
  },
});
```

### pytest Config

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --strict-markers"
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests as integration tests",
]

[tool.coverage.run]
source = ["src"]

[tool.coverage.report]
exclude_lines = ["pragma: no cover", "if __name__ == .__main__.:"]
```

---

## Related Skills

- **vitest**: Write and run tests, mocking, coverage configuration
- **python**: pytest fixtures, parametrize, coverage with pytest-cov
- **bun**: Run tests with `bun test`
- **codemapper**: Find untested code with `cm untested`, `cm tests`
- **typescript**: Type-safe test utilities and assertions
