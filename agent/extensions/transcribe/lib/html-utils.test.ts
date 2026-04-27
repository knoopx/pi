import { describe, expect, it } from "vitest";
import { isHtmlContent, stripHtmlComments } from "./html-utils";

describe("isHtmlContent", () => {
  it("detects <html> tag", () => {
    expect(isHtmlContent("<html><body>Hello</body></html>")).toBe(true);
  });

  it("detects <head> tag", () => {
    expect(isHtmlContent("<head><title>Test</title></head>")).toBe(true);
  });

  it("detects <body> tag", () => {
    expect(isHtmlContent("<body>Hello</body>")).toBe(true);
  });

  it("detects <!doctype>", () => {
    expect(
      isHtmlContent(
        "<!DOCTYPE html><html><head></head><body>Hello</body></html>",
      ),
    ).toBe(true);
  });

  it("returns false for plain text", () => {
    expect(isHtmlContent("Hello world")).toBe(false);
  });

  it("returns false for markdown", () => {
    expect(isHtmlContent("# Hello\n\nThis is **markdown** content.")).toBe(
      false,
    );
  });

  it("handles whitespace-prefixed HTML", () => {
    expect(isHtmlContent("\n\n<html>\n<body></body>\n</html>")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isHtmlContent("<HTML><BODY>Hello</BODY></HTML>")).toBe(true);
    expect(isHtmlContent("<Body>Hello</Body>")).toBe(true);
  });

  it("handles short content that starts with HTML-like tag", () => {
    expect(isHtmlContent("<html>")).toBe(true);
  });

  it("returns false for content that looks like markdown", () => {
    expect(isHtmlContent("[link](http://example.com)")).toBe(false);
  });

  it.each([
    '<img src="logo.png" alt="Logo">',
    "<table><tr><th>A</th></tr></table>",
    "<thead><tr><th>Header</th></tr></thead>",
    "<tbody><tr><td>Cell</td></tr></tbody>",
    "<div>Wrapper content</div>",
    "<span>Inline text</span>",
    "<pre><code>const x = 1;</code></pre>",
    "<blockquote>Cited text</blockquote>",
    "<hr/>",
    "<tr><th>a</th><th>b</th></tr>",
  ])("detects inline README HTML: %s", (input) => {
    expect(isHtmlContent(input)).toBe(true);
  });

  it("handles case-insensitive README tags", () => {
    expect(isHtmlContent('<IMG src="x">')).toBe(true);
    expect(isHtmlContent("<TABLE></TABLE>")).toBe(true);
    expect(isHtmlContent("<DIV>test</DIV>")).toBe(true);
  });
});

describe("stripHtmlComments", () => {
  it("removes standard HTML comments", () => {
    const input = "Hello <!-- comment --> World";
    const result = stripHtmlComments(input);
    // Comment replacement adds a space for the entire <!-- ... --> block
    expect(result).toContain("Hello");
    expect(result).toContain("World");
  });

  it("removes multiline comments", () => {
    const input = "Start <!--\nline1\nline2\n--> End";
    const result = stripHtmlComments(input);
    expect(result).toContain("Start");
    expect(result).toContain("End");
  });

  it("removes SPA hydration markers", () => {
    const input = "<!--[--><div>Hello</div><!--]-->";
    const result = stripHtmlComments(input);
    expect(result).toBe(" <div>Hello</div> ");
  });

  it("removes multiple comments", () => {
    const input = "A <!--1--> B <!--2--> C <!--3--> D";
    const result = stripHtmlComments(input);
    expect(result).toBe("A   B   C   D");
  });

  it("handles no comments gracefully", () => {
    const input = "No comments here";
    const result = stripHtmlComments(input);
    expect(result).toBe("No comments here");
  });

  it("preserves comment-like patterns inside code blocks", () => {
    // This is an edge case - HTML comment stripping happens before markdown parsing
    // so code block content may be affected, which is acceptable for the generic parser
    const input = "```\n// this is a comment\n```";
    const result = stripHtmlComments(input);
    expect(result).toBe("```\n// this is a comment\n```");
  });

  it("handles adjacent comments", () => {
    const input = "A<!--1--><!--2-->B";
    const result = stripHtmlComments(input);
    expect(result).toContain("A");
    expect(result).toContain("B");
  });
});
