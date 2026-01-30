# Module Mocking with Vitest

Mock external dependencies using `vi.mock()` for isolated unit tests.

## Basic Module Mocking

```typescript
import { beforeEach, expect, it, vi } from "vitest";
import { getUserService } from './user-service';

vi.mock('./user-service');

describe("UserService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create user", () => {
    const mockUserService = vi.mocked(getUserService);

    const result = mockUserService.create({ name: "John" });

    expect(result).toBe("user-123");
    expect(mockUserService.create).toHaveBeenCalledWith({ name: "John" });
  });
});
```

## Mocking Dependencies

```typescript
import { describe, it, expect } from "vitest";
import { EmailService } from './email-service';

vi.mock('./email-service', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue(true),
  })),
}));

describe("NotificationService", () => {
  it("should send welcome email", async () => {
    const emailService = new EmailService();

    await emailService.send("Welcome!");

    expect(emailService.send).toHaveBeenCalledWith("Welcome!");
  });
});
```

## Mocking with Return Values

```typescript
vi.mock('./api', () => ({
  fetchData: vi.fn().mockResolvedValue({
    data: "test data",
  }),
}));

vi.mock('./database', () => ({
  query: vi.fn().mockResolvedValue([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]),
}));
```

## See Also

- [Mocking Filesystem](./filesystem-mocking.md)
- [Mocking Requests](./requests-mocking.md)
