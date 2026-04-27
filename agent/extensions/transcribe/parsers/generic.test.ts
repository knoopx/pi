import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { toMarkdown } from "mdast-util-to-markdown";
import { gfmToMarkdown } from "mdast-util-gfm";
import { parse } from "../lib/registry";

describe("Generic parser", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "generic-test-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeAndParse(name: string, content: string): Promise<string> {
    const path = join(dir, name);
    await writeFile(path, content, "utf-8");
    const result = await parse(path);
    if (typeof result === "string") return result;
    return toMarkdown(result, { extensions: [gfmToMarkdown()] });
  }

  describe("matches", () => {
    it("matches all URLs (catch-all)", async () => {
      expect(
        await writeAndParse("url.md", "https://example.com"),
      ).toBeDefined();
    });

    it("matches local file paths", async () => {
      expect(await writeAndParse("path.md", "# Hello")).toBeDefined();
    });

    it("matches any string", async () => {
      expect(await writeAndParse("any.md", "anything")).toBeDefined();
    });
  });

  describe("convert with HTML in markdown", () => {
    it("converts inline HTML table to markdown table", async () => {
      const raw = [
        "# Project Stats",
        "",
        "<table>",
        "<thead>",
        "<tr><th>Name</th><th>Score</th></tr>",
        "</thead>",
        "<tbody>",
        "<tr><td>Model A</td><td>95</td></tr>",
        "<tr><td>Model B</td><td>87</td></tr>",
        "</tbody>",
        "</table>",
      ].join("\n");

      const output = await writeAndParse("table.md", raw);
      expect(output).not.toContain("<table>");
      // GFM table columns may have variable widths
      expect(output).toMatch(/\|\s*Name\s*\|\s*Score\s*\|/);
      expect(output).toMatch(/\|\s*Model A\s*\|\s*95\s*\|/);
      expect(output).toMatch(/\|\s*Model B\s*\|\s*87\s*\|/);
    });

    it("converts inline HTML blockquote to markdown", async () => {
      const raw = [
        "# README",
        "",
        "<blockquote>A great quote</blockquote>",
        "",
        "After the quote.",
      ].join("\n");

      const output = await writeAndParse("blockquote.md", raw);
      expect(output).not.toContain("<blockquote>");
      expect(output).toContain("> A great quote");
    });

    it("handles mixed markdown and HTML in same content", async () => {
      const raw = [
        "# README",
        "",
        '<img src="ci.svg" alt="CI">',
        "",
        "| Feature | Status |",
        "|---------|--------|",
        "<tr><td>Auth</td><td>Done</td></tr>",
        "",
        "<blockquote>A great quote</blockquote>",
      ].join("\n");

      const output = await writeAndParse("mixed.md", raw);
      expect(output).not.toContain("<img");
      expect(output).not.toContain("<tr>");
      expect(output).not.toContain("<blockquote>");
    });

    it("does not break on pure markdown", async () => {
      const output = await writeAndParse(
        "pure.md",
        "# Hello\n\nThis is **markdown** content.",
      );
      expect(output).toContain("# Hello");
      expect(output).toContain("This is **markdown** content.");
    });
  });
});
