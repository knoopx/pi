import { describe, expect, it } from "vitest";
import type { Root as MdastRoot } from "mdast";
import { stripTemplatesAndCommentsFromTextNodes } from "./wikitext";

function makeTree(value: string): MdastRoot {
  return {
    type: "root",
    children: [{ type: "text", value }],
  };
}

describe("stripTemplatesAndCommentsFromTextNodes", () => {
  it("removes double-brace templates", () => {
    const tree = makeTree("Hello {{citation needed}} world");
    stripTemplatesAndCommentsFromTextNodes(tree);
    const text = getText(tree);
    expect(text).toBe("Hello  world");
  });

  it("removes HTML comments", () => {
    const tree = makeTree("Hello <!-- comment --> world");
    stripTemplatesAndCommentsFromTextNodes(tree);
    const text = getText(tree);
    expect(text).toBe("Hello  world");
  });

  it("handles nested braces in templates", () => {
    const tree = makeTree("Text {{foo|bar={{baz}}}} end");
    stripTemplatesAndCommentsFromTextNodes(tree);
    const text = getText(tree);
    expect(text).toBe("Text  end");
  });

  it("preserves text outside templates", () => {
    const tree = makeTree("Before {{template}} between {{another}} after");
    stripTemplatesAndCommentsFromTextNodes(tree);
    const text = getText(tree);
    expect(text).toBe("Before  between  after");
  });

  it("handles multiple comments", () => {
    const tree = makeTree("A <!-- c1 --> B <!-- c2 --> C");
    stripTemplatesAndCommentsFromTextNodes(tree);
    const text = getText(tree);
    expect(text).toBe("A  B  C");
  });

  it("handles mixed templates and comments", () => {
    const tree = makeTree("{{t}} text <!-- c --> more");
    stripTemplatesAndCommentsFromTextNodes(tree);
    const text = getText(tree);
    expect(text).toBe(" text  more");
  });

  it("leaves plain text unchanged", () => {
    const tree = makeTree("Just plain text here");
    stripTemplatesAndCommentsFromTextNodes(tree);
    const text = getText(tree);
    expect(text).toBe("Just plain text here");
  });

  it("handles empty text value", () => {
    const tree: MdastRoot = {
      type: "root",
      children: [{ type: "text", value: "" }],
    };
    stripTemplatesAndCommentsFromTextNodes(tree);
    expect(getText(tree)).toBe("");
  });

  it("handles tree with no text nodes", () => {
    const tree: MdastRoot = {
      type: "root",
      children: [{ type: "heading", depth: 1, children: [] }],
    };
    stripTemplatesAndCommentsFromTextNodes(tree);
    expect(true).toBe(true);
  });
});

function getText(tree: MdastRoot): string {
  const textNode = (tree as MdastRoot).children[0] as { value?: string };
  return textNode.value ?? "";
}
