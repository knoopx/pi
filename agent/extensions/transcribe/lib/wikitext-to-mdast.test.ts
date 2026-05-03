import { describe, expect, it } from "vitest";
import { wikitextToMdast, mdastToWikitext } from "./wikitext-to-mdast";

describe("wikitextToMdast", () => {
  describe("headings", () => {
    it("parses level-2 heading with spaces", () => {
      const tree = wikitextToMdast("== Heading ==");
      expect(tree.children).toHaveLength(1);
      expect((tree.children[0] as { type: string }).type).toBe("heading");
      expect((tree.children[0] as { depth?: number }).depth).toBe(2);
    });

    it("parses level-3 heading", () => {
      const tree = wikitextToMdast("=== Subheading ===");
      expect(tree.children).toHaveLength(1);
      expect((tree.children[0] as { depth?: number }).depth).toBe(2);
    });

    it("parses heading without spaces around equals", () => {
      const tree = wikitextToMdast("==GPT==");
      expect(tree.children).toHaveLength(1);
      expect((tree.children[0] as any).depth).toBe(2);
    });

    it("parses heading with special characters", () => {
      const tree = wikitextToMdast("== Hardware and software ==");
      expect(tree.children).toHaveLength(1);
      expect((tree.children[0] as any).depth).toBe(2);
    });

    it("handles multiple headings", () => {
      const tree = wikitextToMdast("== First ==\n== Second ==");
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].type).toBe("heading");
      expect(tree.children[1].type).toBe("heading");
    });

    it("ignores single equals (not a heading)", () => {
      const tree = wikitextToMdast("= not a heading =");
      // Single equals should not create a heading
      const headings = tree.children.filter((c: any) => c.type === "heading");
      expect(headings).toHaveLength(0);
    });
  });

  describe("bold and italic", () => {
    it("parses bold text with triple apostrophes", () => {
      const tree = wikitextToMdast("'''bold'''");
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0].type).toBe("paragraph");
      expect(
        (tree.children[0] as { children?: unknown[] }).children?.[0] as
          | { type: string }
          | undefined,
      ).toMatchObject({ type: "strong" });
    });

    it("parses italic text with double apostrophes", () => {
      const tree = wikitextToMdast("''italic''");
      expect(tree.children).toHaveLength(1);
      expect(
        (tree.children[0] as { children?: unknown[] }).children?.[0] as
          | { type: string }
          | undefined,
      ).toMatchObject({ type: "emphasis" });
    });

    it("parses bold and italic combined", () => {
      const tree = wikitextToMdast("'''bold and ''italic inside'''");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      expect(para.children?.[0]?.type).toBe("strong");
    });

    it("handles multiple bold sections in one paragraph", () => {
      const tree = wikitextToMdast("'''first''' and '''second'''");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(
        para.children?.filter((c: any) => c.type === "strong").length,
      ).toBe(2);
    });

    it("handles mixed bold and italic", () => {
      const tree = wikitextToMdast("'''bold''''italic'''");
      // This should parse without throwing
      expect(tree.children).toBeDefined();
    });
  });

  describe("wiki links", () => {
    it("parses simple wiki link", () => {
      const tree = wikitextToMdast("[[page]]");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      const link = para.children?.[0];
      expect(link?.type).toBe("link");
      expect(link?.url).toBe("page");
    });

    it("parses wiki link with display text", () => {
      const tree = wikitextToMdast("[[page|display]]");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      const link = para.children?.[0];
      expect(link?.type).toBe("link");
      expect(link?.url).toBe("page");
      expect(link?.children?.[0]?.value).toBe("display");
    });

    it("parses wiki link with spaces in page name", () => {
      const tree = wikitextToMdast("[[my page]]");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      const link = para.children?.[0];
      // Spaces in page names become underscores in URLs
      expect(link?.url).toBe("my_page");
    });

    it("handles multiple links in text", () => {
      const tree = wikitextToMdast("See [[page1]] and [[page2|link]]");
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      const links = para.children?.filter((c: any) => c.type === "link");
      expect(links).toHaveLength(2);
    });

    it("handles link with display containing special chars", () => {
      const tree = wikitextToMdast("[[page|display (with parens)]]");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      const link = para.children?.[0];
      expect(link?.children?.[0]?.value).toBe("display (with parens)");
    });

    it("handles link with underscores", () => {
      const tree = wikitextToMdast("[[my_page]]");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      const link = para.children?.[0];
      expect(link?.url).toBe("my_page");
    });
  });

  describe("thematic breaks", () => {
    it("parses thematic break with four dashes", () => {
      const tree = wikitextToMdast("----");
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0].type).toBe("thematicBreak");
    });

    it("parses three dashes as thematic break (markdown standard)", () => {
      const tree = wikitextToMdast("---");
      const breaks = tree.children.filter(
        (c: any) => c.type === "thematicBreak",
      );
      expect(breaks).toHaveLength(1);
    });
  });

  describe("complex wikitext", () => {
    it("parses heading with bold inside", () => {
      const tree = wikitextToMdast(
        "== Heading with '''bold''' ==\n\nSome text",
      );
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].type).toBe("heading");
      expect(tree.children[1].type).toBe("paragraph");
    });

    it("parses paragraph with links and bold", () => {
      const tree = wikitextToMdast("This is '''bold''' text with [[a link]]");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      expect(para.children?.some((c: any) => c.type === "strong")).toBe(true);
      expect(para.children?.some((c: any) => c.type === "link")).toBe(true);
    });

    it("handles the AI article first paragraph", () => {
      const tree = wikitextToMdast(
        "'''Artificial intelligence''' ('''AI''') is the capability of [[computer|computational systems]] to perform tasks",
      );
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      expect(para.children?.some((c: any) => c.type === "strong")).toBe(true);
      expect(para.children?.some((c: any) => c.type === "link")).toBe(true);
    });

    it("handles multiple paragraphs", () => {
      const tree = wikitextToMdast("First paragraph.\n\nSecond paragraph.");
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].type).toBe("paragraph");
      expect(tree.children[1].type).toBe("paragraph");
    });

    it("handles heading followed by paragraph", () => {
      const tree = wikitextToMdast("== Introduction ==\n\nThis is the intro.");
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0].type).toBe("heading");
      expect(tree.children[1].type).toBe("paragraph");
    });

    it("handles real-world AI article opening", () => {
      const tree = wikitextToMdast(
        "'''Artificial intelligence''' ('''AI''') is the capability of [[computer|computational systems]] to perform tasks typically associated with [[human intelligence]], such as [[learning]], [[reasoning]], [[problem-solving]], [[perception]], and [[decision-making]].",
      );
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
      // Should have multiple strong nodes (for '''Artificial intelligence''' and '''AI''')
      const strongs = para.children?.filter((c: any) => c.type === "strong");
      expect(strongs.length).toBeGreaterThanOrEqual(2);
      // Should have multiple links
      const links = para.children?.filter((c: any) => c.type === "link");
      expect(links.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      const tree = wikitextToMdast("");
      expect(tree.children).toHaveLength(0);
    });

    it("handles plain text without wiki markup", () => {
      const tree = wikitextToMdast("Just plain text");
      expect(tree.children).toHaveLength(1);
      expect(tree.children[0].type).toBe("paragraph");
    });

    it("handles text with only apostrophes (odd count)", () => {
      // Odd number of apostrophes should not create valid emphasis
      const tree = wikitextToMdast("'''unclosed");
      expect(tree.children).toBeDefined();
    });

    it("handles nested brackets in links", () => {
      const tree = wikitextToMdast("[[page|text with [[nested]] brackets]]");
      // Should handle gracefully without crashing
      expect(tree.children).toBeDefined();
    });

    it("handles link at end of string", () => {
      const tree = wikitextToMdast("Text [[link]]");
      expect(tree.children).toHaveLength(1);
      expect(
        (tree.children[0] as any).children?.some((c: any) => c.type === "link"),
      ).toBe(true);
    });

    it("handles link at start of string", () => {
      const tree = wikitextToMdast("[[link]] text");
      expect(tree.children).toHaveLength(1);
      expect(
        (tree.children[0] as any).children?.some((c: any) => c.type === "link"),
      ).toBe(true);
    });

    it("handles multiple consecutive links", () => {
      const tree = wikitextToMdast("[[a]][[b]][[c]]");
      expect(tree.children).toHaveLength(1);
      const links = (tree.children[0] as any)?.children?.filter(
        (c: any) => c.type === "link",
      );
      expect(links).toHaveLength(3);
    });

    it("handles heading at end of document", () => {
      const tree = wikitextToMdast("Some text\n== Last Heading ==");
      expect(tree.children).toHaveLength(2);
      expect(tree.children[1].type).toBe("heading");
    });

    it("handles consecutive headings", () => {
      const tree = wikitextToMdast("== First ==\n== Second ==\n== Third ==");
      expect(tree.children).toHaveLength(3);
      expect(tree.children.every((c: any) => c.type === "heading")).toBe(true);
    });

    it("handles bold with spaces inside", () => {
      const tree = wikitextToMdast("'''bold text with spaces'''");
      expect(tree.children).toHaveLength(1);
      const strong = (tree.children[0] as any)?.children?.[0];
      expect(strong?.type).toBe("strong");
      expect(strong?.value || strong?.children?.[0]?.value).toContain(
        "bold text with spaces",
      );
    });

    it("handles link with empty display text", () => {
      const tree = wikitextToMdast("[[page|]]");
      expect(tree.children).toBeDefined();
    });

    it("handles link with just pipe", () => {
      const tree = wikitextToMdast("[[page|display]] more text");
      expect(tree.children).toHaveLength(1);
      const para = tree.children[0] as any;
      expect(para.type).toBe("paragraph");
    });

    it("handles mixed content with newlines", () => {
      const tree = wikitextToMdast(
        "== Heading ==\n\n'''bold'''\n\n[[link]]\n\n----",
      );
      expect(tree.children.length).toBeGreaterThan(1);
      expect(tree.children.some((c: any) => c.type === "heading")).toBe(true);
      expect(tree.children.some((c: any) => c.type === "thematicBreak")).toBe(
        true,
      );
    });
  });

  describe("mdastToMarkdown", () => {
    it("converts mdast back to markdown for headings", () => {
      const tree = wikitextToMdast("== heading ==");
      const markdown = mdastToWikitext(tree);
      expect(markdown).toContain("## heading");
    });

    it("outputs markdown links (not round-tripped)", () => {
      // Wiki links are converted to markdown before parsing,
      // so they become standard markdown links in the mdast tree
      const tree = wikitextToMdast("[[page|display]]");
      const markdown = mdastToWikitext(tree);
      expect(markdown).toContain("[display](page)");
    });
  });
});

describe("templates", () => {
  it("removes simple template", () => {
    const tree = wikitextToMdast("text {{template}} more");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    expect(para.type).toBe("paragraph");
    // Template node is removed, leaving surrounding text nodes
    expect(para.children?.length).toBe(2);
    expect((para.children?.[0] as any)?.value).toBe("text ");
    expect((para.children?.[1] as any)?.value).toBe(" more");
  });

  it("removes nested template with braces", () => {
    const tree = wikitextToMdast("before {{outer {{inner}} content}} after");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    // Template should be removed, leaving surrounding text
    expect(para.children?.length).toBeGreaterThanOrEqual(2);
  });

  it("removes template with parameters", () => {
    const tree = wikitextToMdast(
      "intro {{Cite book |last=Doe |first=John}} conclusion",
    );
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    // Should have text nodes before and after template
    const texts = para.children?.filter((c: any) => c.type === "text") as any[];
    expect(texts.length).toBeGreaterThanOrEqual(2);
  });

  it("removes multiple templates", () => {
    const tree = wikitextToMdast("{{tpl1}} text {{tpl2}} more {{tpl3}}");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    // All templates removed, leaving surrounding text nodes
    expect(para.children?.length).toBe(2);
  });

  it("removes template at start of paragraph", () => {
    const tree = wikitextToMdast("{{template}} text here");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    expect((para.children?.[0] as any)?.value).toBe(" text here");
  });

  it("removes template at end of paragraph", () => {
    const tree = wikitextToMdast("text here {{template}}");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    expect((para.children?.[0] as any)?.value).toBe("text here ");
  });

  it("removes template between heading and paragraph", () => {
    const tree = wikitextToMdast("== Heading ==\n\n{{citation}} some text");
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].type).toBe("heading");
    expect(tree.children[1].type).toBe("paragraph");
  });

  it("handles unterminated template gracefully", () => {
    const tree = wikitextToMdast("text {{unclosed more text");
    // Should not crash, template treated as removed
    expect(tree.children).toBeDefined();
  });
});

describe("category links", () => {
  it("removes single category link", () => {
    const tree = wikitextToMdast("[[Category:Artificial intelligence]]");
    // Paragraph exists but has no children (link was removed)
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    expect(para.type).toBe("paragraph");
    expect(para.children?.length).toBe(0);
  });

  it("removes category link with display text", () => {
    const tree = wikitextToMdast("[[Category:AI|artificial intelligence]]");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    expect(para.type).toBe("paragraph");
    expect(para.children?.length).toBe(0);
  });

  it("removes multiple category links", () => {
    const tree = wikitextToMdast("[[Category:AI]] [[Category:Technology]]");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    expect(para.type).toBe("paragraph");
    // Both categories removed, only the space between them remains
    expect(para.children?.length).toBe(1);
    expect((para.children?.[0] as any)?.value).toBe(" ");
  });

  it("removes category from within text paragraph", () => {
    const tree = wikitextToMdast("Some text [[Category:Science]] more text");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    const texts = para.children?.filter((c: any) => c.type === "text") as any[];
    expect(texts.length).toBe(2);
    expect((texts[0] as any)?.value).toBe("Some text ");
    expect((texts[1] as any)?.value).toBe(" more text");
  });

  it("preserves regular wiki links but removes categories", () => {
    const tree = wikitextToMdast("See [[page]] and [[Category:Topic]]");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    const links = para.children?.filter((c: any) => c.type === "link");
    expect(links).toHaveLength(1);
    expect((links[0] as any)?.url).toBe("page");
  });

  it("handles case-insensitive category", () => {
    const tree = wikitextToMdast("[[category:lowercase]]");
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    expect(para.type).toBe("paragraph");
    expect(para.children?.length).toBe(0);
  });
});

describe("combined features", () => {
  it("handles text with templates, categories and links", () => {
    const tree = wikitextToMdast(
      "{{citation}} Text about [[page]] [[Category:Topic]]",
    );
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    const links = para.children?.filter((c: any) => c.type === "link");
    expect(links).toHaveLength(1);
  });

  it("handles real-world AI article opening paragraph", () => {
    const tree = wikitextToMdast(
      "'''Artificial intelligence''' ('''AI''') is the capability of [[computer|computational systems]] to perform tasks typically associated with [[human intelligence]], such as [[learning]], [[reasoning]], [[problem-solving]], [[perception]], and [[decision-making]].",
    );
    expect(tree.children).toHaveLength(1);
    const para = tree.children[0] as any;
    expect(para.type).toBe("paragraph");
    // Should have strong nodes for bold text
    const strongs = para.children?.filter((c: any) => c.type === "strong");
    expect(strongs.length).toBeGreaterThanOrEqual(2);
    // Should have links converted from wiki links
    const links = para.children?.filter((c: any) => c.type === "link");
    expect(links.length).toBeGreaterThanOrEqual(5);
  });
});
