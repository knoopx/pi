import { describe, it, expect } from "vitest";
import { parseMarkdown, nodeToText, chunkMarkdown } from "../chunker";

describe("parseMarkdown", () => {
  it("should parse simple markdown", () => {
    const ast = parseMarkdown("# Hello\n\nWorld");
    expect(ast.type).toBe("root");
    expect(ast.children).toHaveLength(2);
    expect(ast.children[0].type).toBe("heading");
    expect(ast.children[1].type).toBe("paragraph");
  });

  it("should parse GFM tables", () => {
    const markdown = `
| Name | Age |
|------|-----|
| John | 30  |
`;
    const ast = parseMarkdown(markdown);
    const table = ast.children.find((c) => c.type === "table");
    expect(table).toBeDefined();
  });

  it("should parse code blocks", () => {
    const markdown = "```typescript\nconst x = 1;\n```";
    const ast = parseMarkdown(markdown);
    expect(ast.children[0].type).toBe("code");
  });
});

describe("nodeToText", () => {
  it("should extract text from heading", () => {
    const ast = parseMarkdown("# Hello World");
    const text = nodeToText(ast.children[0]);
    expect(text).toBe("Hello World");
  });

  it("should extract text from paragraph with formatting", () => {
    const ast = parseMarkdown("**Bold** and *italic*");
    const text = nodeToText(ast.children[0]);
    expect(text).toBe("Bold and italic");
  });
});

describe("chunkMarkdown", () => {
  it("should chunk by headings when groupByHeading is true", () => {
    const markdown = `# Introduction

This is the intro paragraph.

## Section 1

Content of section 1.

## Section 2

Content of section 2.
`;
    const chunks = chunkMarkdown(markdown, "test.md", {
      groupByHeading: true,
      minChunkSize: 10,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.type === "section")).toBe(true);
  });

  it("should include heading context", () => {
    const markdown = `# Main

## Sub

Content here.
`;
    const chunks = chunkMarkdown(markdown, "test.md", {
      groupByHeading: true,
      includeHeadingContext: true,
      minChunkSize: 5,
    });

    const contentChunk = chunks.find((c) => c.content.includes("Content"));
    expect(contentChunk?.heading).toContain("Sub");
  });

  it("should handle code blocks", () => {
    const markdown = `# Code Example

\`\`\`typescript
function hello() {
  return "world";
}
\`\`\`
`;
    const chunks = chunkMarkdown(markdown, "test.md", {
      groupByHeading: true,
      minChunkSize: 10,
    });

    const codeChunk = chunks.find((c) => c.content.includes("function hello"));
    expect(codeChunk).toBeDefined();
  });

  it("should split large sections", () => {
    const longParagraph = "Word ".repeat(500);
    const markdown = `# Long Section

${longParagraph}
`;
    const chunks = chunkMarkdown(markdown, "test.md", {
      maxChunkSize: 200,
      minChunkSize: 50,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 200 + 50)).toBe(true); // Allow some margin
  });

  it("should preserve file path in chunks", () => {
    const chunks = chunkMarkdown("# Test\n\nContent", "docs/test.md", {
      minChunkSize: 5,
    });

    expect(chunks.every((c) => c.filePath === "docs/test.md")).toBe(true);
  });

  it("should generate unique chunk IDs", () => {
    const markdown = `# A

Text A

# B

Text B
`;
    const chunks = chunkMarkdown(markdown, "test.md", { minChunkSize: 5 });
    const ids = chunks.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should skip chunks below minChunkSize", () => {
    const markdown = `# Hi

A

# Hello World

This is a longer paragraph with more content.
`;
    const chunks = chunkMarkdown(markdown, "test.md", {
      minChunkSize: 20,
    });

    expect(chunks.every((c) => c.content.length >= 20)).toBe(true);
  });
});
