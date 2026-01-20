import { describe, it, expect, beforeEach, vi } from "vitest";

// Import the extension
import extension from "./index";

describe("Scenario: Cheatsh Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
    };
  });

  it("should register the command-examples tool", () => {
    extension(mockPi);

    expect(mockPi.registerTool).toHaveBeenCalledTimes(1);
    const toolDef = mockPi.registerTool.mock.calls[0][0];

    expect(toolDef.name).toBe("command-examples");
    expect(toolDef.label).toBe("Command Examples");
    expect(toolDef.description)
      .toBe(`Get command-line examples and reference sheets from cheat.sh.

Use this to:
- Find usage examples for CLI commands
- Get programming language syntax help
- Access quick reference guides
- Learn tool usage patterns

Provides examples for commands, languages, and tools.`);
    expect(typeof toolDef.execute).toBe("function");
  });

  it("should execute tool with mock fetch", async () => {
    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve("# ls\nList directory contents\n\nls -l\nls -a"),
      } as any),
    );

    extension(mockPi);
    const toolDef = mockPi.registerTool.mock.calls[0][0];

    const result = await toolDef.execute(
      "test-id",
      { query: "ls" },
      null,
      null,
      null,
    );

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("# ls");
    expect(result.details.query).toBe("ls");
    expect(result.details.url).toContain("cheat.sh/ls");

    // Restore fetch
    delete global.fetch;
  });

  it("should handle 404 errors", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as any),
    );

    extension(mockPi);
    const toolDef = mockPi.registerTool.mock.calls[0][0];

    const result = await toolDef.execute(
      "test-id",
      { query: "nonexistent" },
      null,
      null,
      null,
    );

    expect(result.content[0].text).toContain("No cheatsheet found");

    delete global.fetch;
  });

  it("should handle network errors", async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error("Network error")));

    extension(mockPi);
    const toolDef = mockPi.registerTool.mock.calls[0][0];

    const result = await toolDef.execute(
      "test-id",
      { query: "ls" },
      null,
      null,
      null,
    );

    expect(result.content[0].text).toContain("Failed to fetch cheatsheet");

    delete global.fetch;
  });

  it("should decode HTML entities in the response", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            "# jj\nJujutsu command examples\n\n$ jj desc -r&quot;trunk()..description(&#x27;&#x27;)&quot;",
          ),
      } as any),
    );

    extension(mockPi);
    const toolDef = mockPi.registerTool.mock.calls[0][0];

    const result = await toolDef.execute(
      "test-id",
      { query: "jj" },
      null,
      null,
      null,
    );

    expect(result.content[0].text).toContain(
      "$ jj desc -r\"trunk()..description('')\"",
    );
    expect(result.content[0].text).not.toContain("&quot;");
    expect(result.content[0].text).not.toContain("&#x27;");

    delete global.fetch;
  });

  it("should handle cancellation", async () => {
    const abortController = new AbortController();
    abortController.abort();

    extension(mockPi);
    const toolDef = mockPi.registerTool.mock.calls[0][0];

    const result = await toolDef.execute(
      "test-id",
      { query: "ls" },
      null,
      null,
      abortController.signal,
    );

    expect(result.content[0].text).toBe("Cancelled");
  });
});
