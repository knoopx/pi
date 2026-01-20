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

  describe("Given command-examples tool", () => {
    let toolDef: any;

    beforeEach(() => {
      extension(mockPi);
      toolDef = mockPi.registerTool.mock.calls[0][0];
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

    it("should handle HTML error responses", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              "<!DOCTYPE html><html><body>404 Not Found</body></html>",
            ),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "nonexistent" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("No cheatsheet found");
      expect(result.details.isHtml).toBe(true);

      delete global.fetch;
    });

    it("should handle 'Unknown topic' responses", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              "Unknown topic.\nDo you mean one of these topics maybe?\n\n* ls 100\n* grep 95",
            ),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "ls" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("No cheatsheet found");
      expect(result.details.isHtml).toBe(true);

      delete global.fetch;
    });

    it("should handle section parameter", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              "# ls /examples\nExamples of ls command\n\nls -l\nls -a",
            ),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "ls", section: "examples" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("# ls /examples");
      expect(result.details.section).toBe("examples");
      expect(result.details.url).toContain("cheat.sh/ls/examples");

      delete global.fetch;
    });

    it("should call onUpdate callback during execution", async () => {
      const mockOnUpdate = vi.fn();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve("# ls\nList contents"),
        } as any),
      );

      await toolDef.execute(
        "test-id",
        { query: "ls" },
        mockOnUpdate,
        null,
        null,
      );

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "text",
              text: expect.stringContaining("Fetching cheatsheet for ls"),
            }),
          ]),
        }),
      );

      delete global.fetch;
    });

    it("should handle cancellation", async () => {
      const abortController = new AbortController();
      abortController.abort();

      const result = await toolDef.execute(
        "test-id",
        { query: "ls" },
        null,
        null,
        abortController.signal,
      );

      expect(result.content[0].text).toBe("Cancelled");
      expect(result.details.query).toBe("ls");
    });

    it("should truncate long content", async () => {
      const longContent = "# ls\n" + "x".repeat(20000);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(longContent),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "ls" },
        null,
        null,
        null,
      );

      expect(result.content[0].text.length).toBeLessThan(15000); // Should be truncated
      expect(result.content[0].text).toContain(
        "[Content truncated at 10000 characters",
      );
      expect(result.details.truncated).toBe(true);
      expect(result.details.contentLength).toBe(20005); // # ls\n (5 chars) + 20000 x's

      delete global.fetch;
    });

    it("should handle request cancellation during fetch", async () => {
      // Mock a slow fetch that will be cancelled
      global.fetch = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                text: () => Promise.resolve("# ls\ncontent"),
              } as any);
            }, 100);
          }),
      );

      const abortController = new AbortController();
      // Abort immediately
      abortController.abort();

      const result = await toolDef.execute(
        "test-id",
        { query: "nonexistent" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toBe("Cancelled");

      delete global.fetch;
    });

    it("should handle non-404 HTTP errors gracefully", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "ls" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("Failed to fetch cheatsheet");
      expect(result.content[0].text).toContain(
        "HTTP 500: Internal Server Error",
      );

      delete global.fetch;
    });

    it("should handle empty response", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(""),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "empty" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toBe("");
      expect(result.details.contentLength).toBe(0);

      delete global.fetch;
    });

    it("should handle response with only whitespace", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve("   \n\t  \n  "),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "whitespace" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toBe("");
      expect(result.details.contentLength).toBe(10);

      delete global.fetch;
    });

    it("should handle complex HTML entities", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              "# Test\n&amp; &lt; &gt; &quot; &#39; &hellip; &mdash; &ndash; &lsquo; &rsquo; &ldquo; &rdquo;",
            ),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "entities" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("& < > \" ' … — – ' ' \" \"");
      expect(result.content[0].text).not.toContain("&amp;");
      expect(result.content[0].text).not.toContain("&lt;");

      delete global.fetch;
    });

    it("should handle case variations in HTML detection", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              "<!doctype html>\n<HTML>\n<body>Error</body>\n</html>",
            ),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "error" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("No cheatsheet found");
      expect(result.details.isHtml).toBe(true);

      delete global.fetch;
    });

    it("should handle case variations in unknown topic detection", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve("UNKNOWN TOPIC.\nSuggestions here..."),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "unknown" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toBe("Cancelled");

      delete global.fetch;
    });

    it("should handle non-404 HTTP errors gracefully", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "ls" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("Failed to fetch cheatsheet");
      expect(result.content[0].text).toContain(
        "HTTP 500: Internal Server Error",
      );

      delete global.fetch;
    });

    it("should handle empty response", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(""),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "empty" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toBe("");
      expect(result.details.contentLength).toBe(0);

      delete global.fetch;
    });

    it("should handle response with only whitespace", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve("   \n\t  \n  "),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "whitespace" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toBe("");
      expect(result.details.contentLength).toBe(10);

      delete global.fetch;
    });

    it("should handle complex HTML entities", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              "# Test\n&amp; &lt; &gt; &quot; &#39; &hellip; &mdash; &ndash; &lsquo; &rsquo; &ldquo; &rdquo;",
            ),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "entities" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("& < > \" ' … — – ' ' \" \"");
      expect(result.content[0].text).not.toContain("&amp;");
      expect(result.content[0].text).not.toContain("&lt;");

      delete global.fetch;
    });

    it("should handle case variations in HTML detection", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              "<!doctype html>\n<HTML>\n<body>Error</body>\n</html>",
            ),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "error" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toContain("No cheatsheet found");
      expect(result.details.isHtml).toBe(true);

      delete global.fetch;
    });

    it("should handle case variations in unknown topic detection", async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve("UNKNOWN TOPIC.\nSuggestions here..."),
        } as any),
      );

      const result = await toolDef.execute(
        "test-id",
        { query: "unknown" },
        null,
        null,
        null,
      );

      expect(result.content[0].text).toBe("Cancelled");
    });
  });
});
