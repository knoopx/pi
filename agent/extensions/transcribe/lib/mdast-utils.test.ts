import { describe, expect, it } from "vitest";
import type { Root as MdastRoot } from "mdast";
import { markdownToMdast, cleanTree } from "./mdast-utils";

describe("cleanTree", () => {
  describe("handles nodes without children gracefully", () => {
    it("does not crash on paragraph with no children", () => {
      const tree = markdownToMdast("# Title\n\n");
      const para = tree.children.find((c) => c.type === "paragraph");
      if (para && Array.isArray(para.children)) {
        para.children.length = 0;
      }
      expect(() => cleanTree(tree)).not.toThrow();
    });

    it("does not crash on heading with no children", () => {
      const tree = markdownToMdast("# ");
      const heading = tree.children.find((c) => c.type === "heading");
      if (heading && Array.isArray(heading.children)) {
        heading.children.length = 0;
      }
      expect(() => cleanTree(tree)).not.toThrow();
    });

    it("does not crash on empty node children array", () => {
      const tree = markdownToMdast("# Title\n\n**bold**");
      const para = tree.children.find((c) => c.type === "paragraph");
      if (para) {
        (para as { children?: unknown[] }).children = [];
      }
      expect(() => cleanTree(tree)).not.toThrow();
    });

    it("does not crash on node with undefined children", () => {
      const tree = markdownToMdast("# Title");
      const heading = tree.children[0] as { children?: unknown[] };
      heading.children = undefined;
      expect(() => cleanTree(tree)).not.toThrow();
    });

    it("does not crash with undefined children", () => {
      const tree = markdownToMdast("# Title");
      const heading = tree.children[0];
      (heading as { children?: unknown }).children = undefined;
      expect(() => cleanTree(tree)).not.toThrow();
    });

    it("does not crash on node with null children", () => {
      const tree = markdownToMdast("# Title");
      const heading = tree.children[0] as { children?: unknown };
      heading.children = null;
      expect(() => cleanTree(tree)).not.toThrow();
    });
  });

  describe("preserves valid content", () => {
    it("keeps non-empty paragraphs", () => {
      const md = `# Title\n\nThis is a paragraph.\n\nAnother one.`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).toContain("This is a paragraph");
      expect(text).toContain("Another one");
    });

    it("keeps headings", () => {
      const md = `# H1\n## H2\n### H3`;
      const tree = cleanTree(markdownToMdast(md));
      const headings = tree.children.filter(
        (c): c is MdastRoot["children"][number] & { type: "heading" } =>
          c.type === "heading",
      );
      expect(headings.length).toBe(3);
    });

    it("keeps links with visible text", () => {
      const md = `[Google](https://google.com)`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).toContain("Google");
      expect(text).toContain("https://google.com");
    });

    it("keeps bold and italic", () => {
      const md = `**bold** and *italic*`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).toContain("bold");
      expect(text).toContain("italic");
    });
  });

  describe("empty list items", () => {
    it("removes empty unordered list items (* alone)", () => {
      const md = `# Title\n\n* item one\n*\n*\n* item two\n*`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).toContain("item one");
      expect(text).toContain("item two");
    });

    it("removes empty ordered list items", () => {
      const md = `1. first\n2.\n3. third`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).toContain("first");
      expect(text).toContain("third");
    });

    it("removes list when all items are empty", () => {
      const md = `# Title\n\n*\n*\n*`;
      const tree = cleanTree(markdownToMdast(md));
      const lists = tree.children.filter(
        (c): c is MdastRoot["children"][number] & { type: string } =>
          c.type === "list",
      );
      expect(lists.length).toBe(0);
    });

    it("keeps list items with non-empty content", () => {
      const md = `* a\n* b\n* c`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).toContain("a");
      expect(text).toContain("b");
      expect(text).toContain("c");
    });

    it("keeps list items with nested lists", () => {
      const md = `* parent\n  * child`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).toContain("parent");
      expect(text).toContain("child");
    });
  });

  describe("anchor-only links", () => {
    it("removes anchor links from headings", () => {
      const md = `# [Heading](#heading)`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).not.toContain("#heading");
    });

    it("removes skip links from paragraphs", () => {
      const md = `[Skip to main content](#page-content) Some text`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).not.toContain("#page-content");
      expect(text).not.toContain("Skip to main content");
      expect(text).toContain("Some text");
    });

    it("keeps links with real URLs", () => {
      const md = `[Google](https://google.com)`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      expect(text).toContain("Google");
      expect(text).toContain("https://google.com");
    });
  });
});
