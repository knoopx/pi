import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ExtensionAPI, AgentToolResult } from "@mariozechner/pi-coding-agent";
import notionExtension, {
  extractPlainText,
  getPageTitle,
  formatProperty,
  blockToText,
  formatSearchResult,
  normalizeNotionId,
} from "./index";

// Mock throttledFetch
vi.mock("../../shared/throttle", () => ({
  throttledFetch: vi.fn(),
}));

import { throttledFetch } from "../../shared/throttle";

const mockFetch = throttledFetch as ReturnType<typeof vi.fn>;

// Type for tool execute function
type ToolExecuteFn = (
  toolCallId: string,
  params: Record<string, unknown>,
  signal: AbortSignal | undefined,
) => Promise<AgentToolResult<Record<string, unknown>>>;

// Helper to extract text from result
function getResultText(result: AgentToolResult<Record<string, unknown>>): string {
  const content = result.content[0];
  if (content.type === "text") {
    return content.text;
  }
  throw new Error(`Expected text content, got ${content.type}`);
}

// Test fixtures
const richText = (text: string) => [{ type: "text", plain_text: text }];

const mockPage = {
  id: "12345678-1234-1234-1234-123456789abc",
  object: "page" as const,
  created_time: "2024-01-01T00:00:00.000Z",
  last_edited_time: "2024-01-02T00:00:00.000Z",
  archived: false,
  url: "https://notion.so/Test-Page",
  parent: { type: "workspace", workspace: true },
  properties: {
    Name: { id: "title", type: "title", title: richText("Test Page") },
    Status: { id: "status", type: "select", select: { name: "Done", color: "green" } },
  },
};

const mockDatabase = {
  id: "abcdef12-3456-7890-abcd-ef1234567890",
  object: "database" as const,
  title: richText("My Database"),
  description: richText("A test database"),
  created_time: "2024-01-01T00:00:00.000Z",
  last_edited_time: "2024-01-02T00:00:00.000Z",
  url: "https://notion.so/My-Database",
  parent: { type: "workspace", workspace: true },
  properties: {
    Name: { id: "title", name: "Name", type: "title" },
    Tags: { id: "tags", name: "Tags", type: "multi_select" },
  },
};

describe("notion extension", () => {
  describe("extractPlainText", () => {
    describe("given an empty array", () => {
      it("then returns empty string", () => {
        expect(extractPlainText([])).toBe("");
      });
    });

    describe("given single rich text element", () => {
      it("then returns plain text", () => {
        expect(extractPlainText(richText("Hello"))).toBe("Hello");
      });
    });

    describe("given multiple rich text elements", () => {
      it("then concatenates all plain text", () => {
        const texts = [
          { type: "text", plain_text: "Hello " },
          { type: "text", plain_text: "World" },
        ];
        expect(extractPlainText(texts)).toBe("Hello World");
      });
    });
  });

  describe("normalizeNotionId", () => {
    describe("given a 32-char ID without dashes", () => {
      it("then formats with proper UUID dashes", () => {
        expect(normalizeNotionId("12345678123412341234123456789abc")).toBe(
          "12345678-1234-1234-1234-123456789abc",
        );
      });
    });

    describe("given a UUID with dashes", () => {
      it("then normalizes to consistent format", () => {
        expect(normalizeNotionId("12345678-1234-1234-1234-123456789abc")).toBe(
          "12345678-1234-1234-1234-123456789abc",
        );
      });
    });

    describe("given a short/invalid ID", () => {
      it("then returns as-is", () => {
        expect(normalizeNotionId("short-id")).toBe("short-id");
      });
    });
  });

  describe("getPageTitle", () => {
    describe("given a page with title property", () => {
      it("then extracts the title text", () => {
        expect(getPageTitle(mockPage)).toBe("Test Page");
      });
    });

    describe("given a page without title property", () => {
      it("then returns 'Untitled'", () => {
        const pageWithoutTitle = {
          ...mockPage,
          properties: { Status: mockPage.properties.Status },
        };
        expect(getPageTitle(pageWithoutTitle)).toBe("Untitled");
      });
    });

    describe("given a page with empty title", () => {
      it("then returns empty string", () => {
        const pageWithEmptyTitle = {
          ...mockPage,
          properties: { Name: { id: "title", type: "title", title: [] } },
        };
        expect(getPageTitle(pageWithEmptyTitle)).toBe("");
      });
    });
  });

  describe("formatProperty", () => {
    const propertyTestCases = [
      { type: "title", prop: { id: "1", type: "title", title: richText("My Title") }, expected: "My Title" },
      { type: "rich_text", prop: { id: "2", type: "rich_text", rich_text: richText("Description") }, expected: "Description" },
      { type: "number", prop: { id: "3", type: "number", number: 42 }, expected: "42" },
      { type: "number (null)", prop: { id: "3", type: "number", number: null }, expected: "" },
      { type: "select", prop: { id: "4", type: "select", select: { name: "Option", color: "blue" } }, expected: "Option" },
      { type: "select (null)", prop: { id: "4", type: "select", select: null }, expected: "" },
      { type: "multi_select", prop: { id: "5", type: "multi_select", multi_select: [{ name: "A", color: "red" }, { name: "B", color: "blue" }] }, expected: "A, B" },
      { type: "date", prop: { id: "6", type: "date", date: { start: "2024-01-01" } }, expected: "2024-01-01" },
      { type: "date range", prop: { id: "6", type: "date", date: { start: "2024-01-01", end: "2024-01-31" } }, expected: "2024-01-01 → 2024-01-31" },
      { type: "date (null)", prop: { id: "6", type: "date", date: null }, expected: "" },
      { type: "checkbox (true)", prop: { id: "7", type: "checkbox", checkbox: true }, expected: "✓" },
      { type: "checkbox (false)", prop: { id: "7", type: "checkbox", checkbox: false }, expected: "✗" },
      { type: "url", prop: { id: "8", type: "url", url: "https://example.com" }, expected: "https://example.com" },
      { type: "email", prop: { id: "9", type: "email", email: "test@example.com" }, expected: "test@example.com" },
      { type: "phone_number", prop: { id: "10", type: "phone_number", phone_number: "+1234567890" }, expected: "+1234567890" },
      { type: "status", prop: { id: "11", type: "status", status: { name: "In Progress", color: "yellow" } }, expected: "In Progress" },
      { type: "people", prop: { id: "12", type: "people", people: [{ id: "u1", name: "Alice", type: "person" }, { id: "u2", type: "person" }] }, expected: "Alice, u2" },
      { type: "files", prop: { id: "13", type: "files", files: [{ name: "doc.pdf", type: "file" }] }, expected: "doc.pdf" },
      { type: "formula (string)", prop: { id: "14", type: "formula", formula: { type: "string", string: "result" } }, expected: "result" },
      { type: "formula (number)", prop: { id: "14", type: "formula", formula: { type: "number", number: 100 } }, expected: "100" },
      { type: "formula (boolean)", prop: { id: "14", type: "formula", formula: { type: "boolean", boolean: true } }, expected: "true" },
      { type: "relation", prop: { id: "15", type: "relation", relation: [{ id: "page1" }, { id: "page2" }] }, expected: "page1, page2" },
      { type: "unknown", prop: { id: "99", type: "custom_type" }, expected: "[custom_type]" },
    ];

    propertyTestCases.forEach(({ type, prop, expected }) => {
      describe(`given a ${type} property`, () => {
        it(`then returns "${expected}"`, () => {
          expect(formatProperty(prop as Parameters<typeof formatProperty>[0])).toBe(expected);
        });
      });
    });
  });

  describe("blockToText", () => {
    const blockTestCases = [
      { type: "paragraph", block: { id: "1", object: "block", type: "paragraph", has_children: false, archived: false, paragraph: { rich_text: richText("Hello world") } }, expected: "Hello world" },
      { type: "heading_1", block: { id: "2", object: "block", type: "heading_1", has_children: false, archived: false, heading_1: { rich_text: richText("Title") } }, expected: "# Title" },
      { type: "heading_2", block: { id: "3", object: "block", type: "heading_2", has_children: false, archived: false, heading_2: { rich_text: richText("Subtitle") } }, expected: "## Subtitle" },
      { type: "heading_3", block: { id: "4", object: "block", type: "heading_3", has_children: false, archived: false, heading_3: { rich_text: richText("Section") } }, expected: "### Section" },
      { type: "bulleted_list_item", block: { id: "5", object: "block", type: "bulleted_list_item", has_children: false, archived: false, bulleted_list_item: { rich_text: richText("Item") } }, expected: "- Item" },
      { type: "numbered_list_item", block: { id: "6", object: "block", type: "numbered_list_item", has_children: false, archived: false, numbered_list_item: { rich_text: richText("Step") } }, expected: "1. Step" },
      { type: "to_do (unchecked)", block: { id: "7", object: "block", type: "to_do", has_children: false, archived: false, to_do: { rich_text: richText("Task"), checked: false } }, expected: "- [ ] Task" },
      { type: "to_do (checked)", block: { id: "8", object: "block", type: "to_do", has_children: false, archived: false, to_do: { rich_text: richText("Done"), checked: true } }, expected: "- [x] Done" },
      { type: "quote", block: { id: "9", object: "block", type: "quote", has_children: false, archived: false, quote: { rich_text: richText("Quote text") } }, expected: "> Quote text" },
      { type: "callout", block: { id: "10", object: "block", type: "callout", has_children: false, archived: false, callout: { rich_text: richText("Note"), icon: { emoji: "⚠️" } } }, expected: "> ⚠️ Note" },
      { type: "divider", block: { id: "11", object: "block", type: "divider", has_children: false, archived: false, divider: {} }, expected: "---" },
      { type: "child_page", block: { id: "12", object: "block", type: "child_page", has_children: false, archived: false, child_page: { title: "Subpage" } }, expected: "- 📄 Subpage" },
      { type: "child_database", block: { id: "13", object: "block", type: "child_database", has_children: false, archived: false, child_database: { title: "Subdb" } }, expected: "- 📊 Subdb" },
      { type: "bookmark", block: { id: "14", object: "block", type: "bookmark", has_children: false, archived: false, bookmark: { url: "https://example.com", caption: [] } }, expected: "[https://example.com](https://example.com)" },
      { type: "link_preview", block: { id: "15", object: "block", type: "link_preview", has_children: false, archived: false, link_preview: { url: "https://github.com" } }, expected: "[https://github.com](https://github.com)" },
      { type: "table_of_contents", block: { id: "16", object: "block", type: "table_of_contents", has_children: false, archived: false, table_of_contents: {} }, expected: "*[Table of Contents]*" },
      { type: "unknown", block: { id: "17", object: "block", type: "embed", has_children: false, archived: false }, expected: "*[embed block]*" },
    ];

    blockTestCases.forEach(({ type, block, expected }) => {
      describe(`given a ${type} block`, () => {
        it(`then returns markdown: "${expected}"`, () => {
          expect(blockToText(block as Parameters<typeof blockToText>[0])).toBe(expected);
        });
      });
    });

    describe("given an indent level", () => {
      it("then adds indentation prefix", () => {
        const block = {
          id: "1",
          object: "block" as const,
          type: "paragraph",
          has_children: false,
          archived: false,
          paragraph: { rich_text: richText("Nested") },
        };
        expect(blockToText(block, 2)).toBe("    Nested");
      });
    });

    describe("given a code block", () => {
      it("then wraps in fenced code block with language", () => {
        const block = {
          id: "1",
          object: "block" as const,
          type: "code",
          has_children: false,
          archived: false,
          code: { rich_text: richText("const x = 1;"), language: "typescript" },
        };
        expect(blockToText(block)).toBe("```typescript\nconst x = 1;\n```");
      });
    });

    describe("given an image block with file URL", () => {
      it("then returns markdown image syntax", () => {
        const block = {
          id: "1",
          object: "block" as const,
          type: "image",
          has_children: false,
          archived: false,
          image: { type: "file", file: { url: "https://cdn.notion.so/image.png" } },
        };
        expect(blockToText(block)).toBe("![image](https://cdn.notion.so/image.png)");
      });
    });

    describe("given an image block with external URL", () => {
      it("then returns markdown image syntax", () => {
        const block = {
          id: "1",
          object: "block" as const,
          type: "image",
          has_children: false,
          archived: false,
          image: { type: "external", external: { url: "https://example.com/img.jpg" } },
        };
        expect(blockToText(block)).toBe("![image](https://example.com/img.jpg)");
      });
    });

    describe("given a toggle block", () => {
      it("then returns HTML details element", () => {
        const block = {
          id: "1",
          object: "block" as const,
          type: "toggle",
          has_children: true,
          archived: false,
          toggle: { rich_text: richText("Click to expand") },
        };
        expect(blockToText(block)).toBe("<details><summary>Click to expand</summary></details>");
      });
    });
  });

  describe("formatSearchResult", () => {
    describe("given a page result", () => {
      it("then formats as markdown list item with page icon", () => {
        const result = formatSearchResult(mockPage);
        expect(result).toContain("- **Test Page** (page)");
        expect(result).toContain("ID: `12345678-1234-1234-1234-123456789abc`");
        expect(result).toContain("URL: https://notion.so/Test-Page");
      });
    });

    describe("given a database result", () => {
      it("then formats as markdown list item with database icon", () => {
        const result = formatSearchResult(mockDatabase);
        expect(result).toContain("- **My Database** (database)");
        expect(result).toContain("ID: `abcdef12-3456-7890-abcd-ef1234567890`");
        expect(result).toContain("URL: https://notion.so/My-Database");
      });
    });
  });

  describe("tool registration", () => {
    const registeredTools = new Map<string, { name: string; description: string; execute: ToolExecuteFn }>();

    const mockPi: Partial<ExtensionAPI> = {
      registerTool: vi.fn((def) => {
        registeredTools.set(def.name, {
          name: def.name,
          description: def.description,
          execute: def.execute as ToolExecuteFn,
        });
      }),
    };

    beforeEach(() => {
      registeredTools.clear();
      notionExtension(mockPi as ExtensionAPI);
    });

    it("then registers all four tools", () => {
      expect(registeredTools.size).toBe(4);
      expect([...registeredTools.keys()]).toEqual([
        "notion-search",
        "notion-get-page",
        "notion-list-databases",
        "notion-query-database",
      ]);
    });

    it("then includes API key requirement in descriptions", () => {
      for (const tool of registeredTools.values()) {
        expect(tool.description).toContain("NOTION_API_KEY");
      }
    });
  });

  describe("notion-search tool", () => {
    let executeTool: ToolExecuteFn;

    beforeEach(() => {
      vi.resetAllMocks();
      process.env.NOTION_API_KEY = "test-api-key";

      const tools = new Map<string, { execute: ToolExecuteFn }>();
      const mockPi: Partial<ExtensionAPI> = {
        registerTool: vi.fn((def) => tools.set(def.name, { execute: def.execute as ToolExecuteFn })),
      };
      notionExtension(mockPi as ExtensionAPI);
      executeTool = tools.get("notion-search")!.execute;
    });

    afterEach(() => {
      delete process.env.NOTION_API_KEY;
    });

    describe("given no API key", () => {
      beforeEach(() => {
        delete process.env.NOTION_API_KEY;
      });

      it("then returns error about missing key", async () => {
        const result = await executeTool("test-id", { query: "test" }, undefined);
        expect(getResultText(result)).toContain("Error:");
        expect(getResultText(result)).toContain("NOTION_API_KEY");
      });
    });

    describe("given API returns results", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [mockPage, mockDatabase],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then returns formatted markdown results", async () => {
        const result = await executeTool("test-id", { query: "test" }, undefined);
        expect(getResultText(result)).toContain("Found 2 result(s):");
        expect(getResultText(result)).toContain("**Test Page** (page)");
        expect(getResultText(result)).toContain("**My Database** (database)");
        expect(result.details.count).toBe(2);
      });
    });

    describe("given API returns empty results", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then returns no results message", async () => {
        const result = await executeTool("test-id", { query: "nonexistent" }, undefined);
        expect(getResultText(result)).toContain('No results found for "nonexistent"');
        expect(result.details.count).toBe(0);
      });
    });

    describe("given API returns error", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          json: () => Promise.resolve({ message: "Invalid API key" }),
        });
      });

      it("then returns error result", async () => {
        const result = await executeTool("test-id", { query: "test" }, undefined);
        expect(getResultText(result)).toContain("Error:");
        expect(getResultText(result)).toContain("Invalid API key");
        expect(result.details.error).toBeDefined();
      });
    });

    describe("given filter parameter", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [mockPage],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then includes filter in request body", async () => {
        await executeTool("test-id", { query: "test", filter: "page" }, undefined);
        const call = mockFetch.mock.calls[0];
        const body = JSON.parse(call[1].body);
        expect(body.filter).toEqual({ value: "page", property: "object" });
      });
    });
  });

  describe("notion-get-page tool", () => {
    let executeTool: ToolExecuteFn;

    beforeEach(() => {
      vi.resetAllMocks();
      process.env.NOTION_API_KEY = "test-api-key";

      const tools = new Map<string, { execute: ToolExecuteFn }>();
      const mockPi: Partial<ExtensionAPI> = {
        registerTool: vi.fn((def) => tools.set(def.name, { execute: def.execute as ToolExecuteFn })),
      };
      notionExtension(mockPi as ExtensionAPI);
      executeTool = tools.get("notion-get-page")!.execute;
    });

    afterEach(() => {
      delete process.env.NOTION_API_KEY;
    });

    describe("given a page ID without dashes", () => {
      beforeEach(() => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockPage),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                object: "list",
                results: [
                  { id: "b1", object: "block", type: "paragraph", has_children: false, archived: false, paragraph: { rich_text: richText("Hello") } },
                ],
                next_cursor: null,
                has_more: false,
              }),
          });
      });

      it("then normalizes ID and fetches page", async () => {
        const result = await executeTool(
          "test-id",
          { pageId: "12345678123412341234123456789abc" },
          undefined,
        );
        expect(getResultText(result)).toContain("# Test Page");
        expect(mockFetch.mock.calls[0][0]).toContain("12345678-1234-1234-1234-123456789abc");
      });
    });

    describe("given includeContent is false", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPage),
        });
      });

      it("then skips fetching blocks", async () => {
        const result = await executeTool(
          "test-id",
          { pageId: "12345678-1234-1234-1234-123456789abc", includeContent: false },
          undefined,
        );
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(getResultText(result)).not.toContain("## Content");
      });
    });

    describe("given page with properties", () => {
      beforeEach(() => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockPage),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ object: "list", results: [], next_cursor: null, has_more: false }),
          });
      });

      it("then includes formatted properties", async () => {
        const result = await executeTool(
          "test-id",
          { pageId: "12345678-1234-1234-1234-123456789abc" },
          undefined,
        );
        expect(getResultText(result)).toContain("## Properties");
        expect(getResultText(result)).toContain("**Status:** Done");
      });
    });
  });

  describe("notion-list-databases tool", () => {
    let executeTool: ToolExecuteFn;

    beforeEach(() => {
      vi.resetAllMocks();
      process.env.NOTION_API_KEY = "test-api-key";

      const tools = new Map<string, { execute: ToolExecuteFn }>();
      const mockPi: Partial<ExtensionAPI> = {
        registerTool: vi.fn((def) => tools.set(def.name, { execute: def.execute as ToolExecuteFn })),
      };
      notionExtension(mockPi as ExtensionAPI);
      executeTool = tools.get("notion-list-databases")!.execute;
    });

    afterEach(() => {
      delete process.env.NOTION_API_KEY;
    });

    describe("given databases exist", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [mockDatabase],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then returns formatted database list", async () => {
        const result = await executeTool("test-id", {}, undefined);
        expect(getResultText(result)).toContain("Found 1 database(s):");
        expect(getResultText(result)).toContain("**My Database**");
        expect(getResultText(result)).toContain("Properties: `Name`, `Tags`");
        expect(result.details.count).toBe(1);
      });
    });

    describe("given no databases", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then returns helpful message", async () => {
        const result = await executeTool("test-id", {}, undefined);
        expect(getResultText(result)).toContain("No databases found");
        expect(getResultText(result)).toContain("integration has access");
      });
    });
  });

  describe("notion-query-database tool", () => {
    let executeTool: ToolExecuteFn;

    beforeEach(() => {
      vi.resetAllMocks();
      process.env.NOTION_API_KEY = "test-api-key";

      const tools = new Map<string, { execute: ToolExecuteFn }>();
      const mockPi: Partial<ExtensionAPI> = {
        registerTool: vi.fn((def) => tools.set(def.name, { execute: def.execute as ToolExecuteFn })),
      };
      notionExtension(mockPi as ExtensionAPI);
      executeTool = tools.get("notion-query-database")!.execute;
    });

    afterEach(() => {
      delete process.env.NOTION_API_KEY;
    });

    describe("given database with entries", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [mockPage],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then returns formatted entries", async () => {
        const result = await executeTool(
          "test-id",
          { databaseId: "abcdef12-3456-7890-abcd-ef1234567890" },
          undefined,
        );
        expect(getResultText(result)).toContain("Found 1 entry/entries:");
        expect(getResultText(result)).toContain("**Test Page**");
        expect(result.details.count).toBe(1);
      });
    });

    describe("given filter parameter", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then parses and includes filter in request", async () => {
        const filter = JSON.stringify({ property: "Status", select: { equals: "Done" } });
        await executeTool(
          "test-id",
          { databaseId: "abcdef12-3456-7890-abcd-ef1234567890", filter },
          undefined,
        );
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.filter).toEqual({ property: "Status", select: { equals: "Done" } });
      });
    });

    describe("given sorts parameter", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then parses and includes sorts in request", async () => {
        const sorts = JSON.stringify([{ property: "Name", direction: "ascending" }]);
        await executeTool(
          "test-id",
          { databaseId: "abcdef12-3456-7890-abcd-ef1234567890", sorts },
          undefined,
        );
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.sorts).toEqual([{ property: "Name", direction: "ascending" }]);
      });
    });

    describe("given invalid filter JSON", () => {
      it("then returns error result", async () => {
        const result = await executeTool(
          "test-id",
          { databaseId: "abcdef12-3456-7890-abcd-ef1234567890", filter: "not-json" },
          undefined,
        );
        expect(getResultText(result)).toContain("Error:");
        expect(result.details.error).toBeDefined();
      });
    });

    describe("given empty database", () => {
      beforeEach(() => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              object: "list",
              results: [],
              next_cursor: null,
              has_more: false,
            }),
        });
      });

      it("then returns no entries message", async () => {
        const result = await executeTool(
          "test-id",
          { databaseId: "abcdef12-3456-7890-abcd-ef1234567890" },
          undefined,
        );
        expect(getResultText(result)).toContain("No entries found in database");
        expect(result.details.count).toBe(0);
      });
    });
  });
});
