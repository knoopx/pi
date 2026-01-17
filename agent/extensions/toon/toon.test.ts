import { describe, it, expect, vi, type MockedFunction } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Mock the encode function to verify it's called
vi.mock("@toon-format/toon", () => ({
  encode: vi.fn(),
}));

// Import after mock
import { encode } from "@toon-format/toon";

// Get the mocked encode function
const mockEncode = encode as MockedFunction<typeof encode>;

describe("toon-rewriter extension", () => {
  it("should convert JSON tool result content to TOON format", async () => {
    // Mock the ExtensionAPI
    const mockPi = {
      on: vi.fn(),
    } as unknown as ExtensionAPI;

    // Import and initialize the extension
    const extension = (await import("./index")).default;
    extension(mockPi);

    // Verify the event listener is registered
    expect(mockPi.on).toHaveBeenCalledWith("tool_result", expect.any(Function));

    const handler = (mockPi.on as any).mock.calls[0][1];

    // Test data
    const jsonData = { users: [{ name: "Alice", age: 30 }] };
    const toonOutput = "users[1]{name,age}:\n  Alice,30";

    mockEncode.mockReturnValue(toonOutput);

    const event = {
      toolName: "search-web",
      toolCallId: "123",
      input: {},
      content: [{ type: "text", text: JSON.stringify(jsonData) }],
      details: { some: "detail" },
      isError: false,
    };

    const result = await handler(event);

    expect(mockEncode).toHaveBeenCalledWith(jsonData);
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: toonOutput,
        },
      ],
      details: { some: "detail" },
      isError: false,
    });
  });

  it("should not modify non-JSON content", async () => {
    mockEncode.mockClear();

    const mockPi = {
      on: vi.fn(),
    } as unknown as ExtensionAPI;

    const extension = (await import("./index")).default;
    extension(mockPi);

    const handler = (mockPi.on as any).mock.calls[0][1];

    const event = {
      toolName: "bash",
      toolCallId: "456",
      input: {},
      content: [{ type: "text", text: "some output" }],
      details: {},
      isError: false,
    };

    const result = await handler(event);

    expect(mockEncode).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should not modify invalid JSON", async () => {
    mockEncode.mockClear();

    const mockPi = {
      on: vi.fn(),
    } as unknown as ExtensionAPI;

    const extension = (await import("./index")).default;
    extension(mockPi);

    const handler = (mockPi.on as any).mock.calls[0][1];

    const event = {
      toolName: "read",
      toolCallId: "789",
      input: {},
      content: [{ type: "text", text: "{ invalid json" }],
      details: {},
      isError: false,
    };

    const result = await handler(event);

    expect(mockEncode).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should not modify primitive JSON values", async () => {
    mockEncode.mockClear();

    const mockPi = {
      on: vi.fn(),
    } as unknown as ExtensionAPI;

    const extension = (await import("./index")).default;
    extension(mockPi);

    const handler = (mockPi.on as any).mock.calls[0][1];

    const event = {
      toolName: "some-tool",
      toolCallId: "101",
      input: {},
      content: [{ type: "text", text: '"just a string"' }],
      details: {},
      isError: false,
    };

    const result = await handler(event);

    expect(mockEncode).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it("should handle multiple content blocks (only process single text block)", async () => {
    mockEncode.mockClear();

    const mockPi = {
      on: vi.fn(),
    } as unknown as ExtensionAPI;

    const extension = (await import("./index")).default;
    extension(mockPi);

    const handler = (mockPi.on as any).mock.calls[0][1];

    const event = {
      toolName: "some-tool",
      toolCallId: "102",
      input: {},
      content: [
        { type: "text", text: "first" },
        { type: "text", text: '{"key": "value"}' },
      ],
      details: {},
      isError: false,
    };

    const result = await handler(event);

    expect(mockEncode).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
