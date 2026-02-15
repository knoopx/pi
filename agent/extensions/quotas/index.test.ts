import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";

// Use doMock instead of mock to avoid hoisting pollution
let quotasExtension: typeof import("./index").default;

beforeAll(async () => {
  // Import after mocking
  const quotasExtensionModule = await import("./index");
  quotasExtension = quotasExtensionModule.default;
});

afterAll(() => {
  vi.resetModules();
});

describe("Quotas Extension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("quotasExtension", () => {
    describe("given extension initialization", () => {
      it("then registers commands and event handlers", async () => {
        const mockPI = {
          on: vi.fn(),
          registerCommand: vi.fn(),
        };

        await quotasExtension(
          mockPI as unknown as Parameters<typeof quotasExtension>[0],
        );

        expect(mockPI.registerCommand).toHaveBeenCalledWith(
          "quotas:refresh",
          expect.any(Object),
        );
        expect(mockPI.on).toHaveBeenCalledWith(
          "session_start",
          expect.any(Function),
        );
        expect(mockPI.on).toHaveBeenCalledWith(
          "model_select",
          expect.any(Function),
        );
      });
    });

    describe("given context events", () => {
      it("then handles session start", async () => {
        const mockPI = {
          on: vi.fn(),
          registerCommand: vi.fn(),
        };

        await quotasExtension(
          mockPI as unknown as Parameters<typeof quotasExtension>[0],
        );

        const sessionStartHandler = mockPI.on.mock.calls.find(
          (call) => call[0] === "session_start",
        )?.[1];

        expect(sessionStartHandler).toBeDefined();

        const mockCtx = {
          model: { provider: "openai", id: "gpt-4" },
          ui: {
            setWidget: vi.fn(),
          },
        };

        await sessionStartHandler({}, mockCtx);

        expect(mockCtx.ui.setWidget).toHaveBeenCalled();
      });

      it("then handles model select", async () => {
        const mockPI = {
          on: vi.fn(),
          registerCommand: vi.fn(),
        };

        await quotasExtension(
          mockPI as unknown as Parameters<typeof quotasExtension>[0],
        );

        const modelSelectHandler = mockPI.on.mock.calls.find(
          (call) => call[0] === "model_select",
        )?.[1];

        expect(modelSelectHandler).toBeDefined();

        const mockCtx = {
          model: { provider: "anthropic", id: "claude-3" },
          ui: {
            setWidget: vi.fn(),
          },
        };

        await modelSelectHandler({}, mockCtx);

        expect(mockCtx.ui.setWidget).toHaveBeenCalled();
      });
    });

    describe("given quota refresh command", () => {
      it("then executes refresh handler", async () => {
        const mockPI = {
          on: vi.fn(),
          registerCommand: vi.fn(),
        };

        await quotasExtension(
          mockPI as unknown as Parameters<typeof quotasExtension>[0],
        );

        const commandHandler = mockPI.registerCommand.mock.calls.find(
          (call) => call[0] === "quotas:refresh",
        )?.[1];

        expect(commandHandler).toBeDefined();

        const mockCtx = {
          args: [],
          cwd: "/test/project",
        };

        await commandHandler.handler(mockCtx);

        // Command should execute without throwing
        expect(true).toBe(true);
      });
    });
  });
});
