---
description: Create comprehensive tests for a module using BDD principles
---

Create comprehensive tests for the module "$1" following BDD principles.

<requirements>
  * Fast, isolated, business logic
  * Component interactions, APIs
  * Critical user journeys
</requirements>

<bdd_structure>
Use Given-When-Then with nested describe blocks:

```typescript
describe("Module", () => {
  describe("given valid input", () => {
    describe("when processing", () => {
      it("then returns expected output", () => {
        expect(result).toBe(expected);
      });
    });
  });
});
```

</bdd_structure>

<what_to_test>
✅ TEST: Business logic, edge cases, error handling, public APIs, security
❌ SKIP: Framework code, trivial getters, third-party libs, UI layout
</what_to_test>

<test_patterns>

### Basic Test

```typescript
describe("given valid user data", () => {
  const userData = { name: "Alice", email: "alice@example.com" };

  describe("when creating user", () => {
    it("then user is persisted with ID", () => {
      const result = createUser(userData);
      expect(result.id).toBeDefined();
    });
  });
});
```

### With Mocks

```typescript
vi.mock("./email-service");

describe("given email service configured", () => {
  beforeEach(() => {
    emailService = new EmailService();
  });

  describe("when user registers", () => {
    it("then welcome email is sent", () => {
      userService.create(userData);
      expect(emailService.send).toHaveBeenCalled();
    });
  });
});
```

### Parametrized

```typescript
const cases = [
  { input: 50, expected: 0, scenario: "under threshold" },
  { input: 100, expected: 10, scenario: "at threshold" },
];

cases.forEach(({ input, expected, scenario }) => {
  describe(`given ${scenario}`, () => {
    it(`then returns ${expected}`, () => {
      expect(calculate(input)).toBe(expected);
    });
  });
});
```

</test_patterns>

<checklist>
- [ ] Follow existing project test naming conventions
- [ ] Test files map 1:1 to their source filenames (same directory structure as sources)
- [ ] Tests follow BDD Given-When-Then structure
- [ ] Tests are independent and isolated
- [ ] Error handling tested for all failure paths
- [ ] Edge cases and boundaries covered
- [ ] Tests run fast
- [ ] Test names describe behavior
- [ ] Each test has single reason to fail
</checklist>

<commands>
```bash
# Vitest
vitest run                    # Run all
vitest run -t "pattern"       # Filter
vitest run --coverage         # Coverage

# pytest

uv run pytest -v # Verbose
uv run pytest --cov=src # Coverage

# Bun

bun test # Run all
bun test --coverage # Coverage

```
</commands>

<additional_context>
$@
</additional_context>
```
