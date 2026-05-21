import { describe, expect, it } from "vitest";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import { cleanMdastTree } from "./tree-cleaning";

function makeRoot(children: unknown[]): Root {
  return {
    type: "root",
    children,
  } as Root;
}

function makeNode(type: string, props = {}) {
  return {
    type,
    children: [],
    position: {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    },
    ...props,
  };
}

function makeText(value: string) {
  return {
    type: "text",
    value,
    position: {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    },
  };
}

describe("cleanMdastTree", () => {
  it("removes references section headings", () => {
    const tree = makeRoot([
      makeNode("heading", { depth: 2, children: [makeText("References")] }),
      makeNode("paragraph", { children: [makeText("Some content")] }),
    ]);
    cleanMdastTree(tree);
    const headings = tree.children.filter(
      (c) => (c as { type?: string }).type === "heading",
    );
    expect(headings).toHaveLength(0);
  });

  it("removes external links section headings", () => {
    const tree = makeRoot([
      makeNode("heading", { depth: 2, children: [makeText("External links")] }),
    ]);
    cleanMdastTree(tree);
    expect(tree.children).toHaveLength(0);
  });

  it("removes see also section headings", () => {
    const tree = makeRoot([
      makeNode("heading", { depth: 2, children: [makeText("See also")] }),
    ]);
    cleanMdastTree(tree);
    expect(tree.children).toHaveLength(0);
  });

  it("removes notes section headings", () => {
    const tree = makeRoot([
      makeNode("heading", { depth: 2, children: [makeText("Notes")] }),
    ]);
    cleanMdastTree(tree);
    expect(tree.children).toHaveLength(0);
  });

  it("keeps regular headings", () => {
    const tree = makeRoot([
      makeNode("heading", { depth: 2, children: [makeText("History")] }),
    ]);
    cleanMdastTree(tree);
    expect(tree.children).toHaveLength(1);
  });

  it("keeps paragraphs with bold text", () => {
    const strong = makeNode("strong", { children: [makeText("bold")] });
    const tree = makeRoot([makeNode("paragraph", { children: [strong] })]);
    cleanMdastTree(tree);
    expect(tree.children).toHaveLength(1);
  });

  it("keeps paragraphs with regular text", () => {
    const tree = makeRoot([
      makeNode("paragraph", { children: [makeText("Some paragraph text")] }),
    ]);
    cleanMdastTree(tree);
    expect(tree.children).toHaveLength(1);
  });

  it("removes multiple section headings at once", () => {
    const tree = makeRoot([
      makeNode("heading", { depth: 2, children: [makeText("History")] }),
      makeNode("heading", { depth: 2, children: [makeText("References")] }),
      makeNode("heading", { depth: 2, children: [makeText("External links")] }),
      makeNode("heading", { depth: 2, children: [makeText("See also")] }),
    ]);
    cleanMdastTree(tree);
    const remaining = tree.children.filter(
      (c) => (c as { type?: string }).type === "heading",
    );
    expect(remaining).toHaveLength(1);
    expect((remaining[0] as { children?: unknown[] }).children).toMatchObject([
      { type: "text", value: "History" },
    ]);
  });

  it("visit finds paragraphs in proper tree", () => {
    const tree = makeRoot([
      makeNode("paragraph", { children: [] }),
      makeNode("paragraph", { children: [makeText("content")] }),
    ]);
    const found: string[] = [];
    visit(tree, "paragraph", (node) => {
      found.push(
        (node as { children?: unknown[] }).children?.length?.toString() ??
          "no-children",
      );
    });
    expect(found).toEqual(["0", "1"]);
  });
});
