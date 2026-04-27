import { describe, expect, it } from "vitest";
import type { Root as MdastRoot } from "mdast";
import { markdownToMdast, cleanTree } from "./mdast-utils";

describe("cleanTree", () => {
  describe("handles nodes without children gracefully", () => {
    it("does not crash on paragraph with no children", () => {
      const tree = markdownToMdast("# Title\n\n");
      // Manually inject a paragraph node without children to test the guard
      const para = tree.children.find((c) => c.type === "paragraph");
      if (para && Array.isArray(para.children)) {
        para.children.length = 0;
      }
      // Should not throw
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
      // Set children to an empty array (not undefined, but also not containing valid nodes)
      const para = tree.children.find((c) => c.type === "paragraph");
      if (para) {
        (para as { children?: unknown[] }).children = [];
      }
      expect(() => cleanTree(tree)).not.toThrow();
    });

    it("does not crash on node with undefined children", () => {
      const tree = markdownToMdast("# Title");
      // Set children to undefined
      const heading = tree.children[0] as { children?: unknown[] };
      heading.children = undefined;
      expect(() => cleanTree(tree)).not.toThrow();
    });

    it("does not crash with undefined children", () => {
      const tree = markdownToMdast("# Title");
      // Set children to undefined - should be handled gracefully
      const heading = tree.children[0];
      (heading as { children?: unknown }).children = undefined;
      expect(() => cleanTree(tree)).not.toThrow();
    });

    it("does not crash on node with null children", () => {
      const tree = markdownToMdast("# Title");
      // Set children to null
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

  describe("empty anchor links in headings", () => {
    it("preserves headings with non-empty links", () => {
      const md = `# [Heading](#heading)`;
      const tree = cleanTree(markdownToMdast(md));
      const text = JSON.stringify(tree);
      // The link should remain since it has visible text "Heading"
      expect(text).toContain("Heading");
    });
  });
});
