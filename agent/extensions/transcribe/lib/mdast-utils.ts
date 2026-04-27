import type { Root as MdastRoot } from "mdast";
import type { Node } from "unist";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { removeNodesByIndex } from "./tree-utils.js";
import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";

export function markdownToMdast(text: string): MdastRoot {
  return fromMarkdown(text, undefined, {
    mdastExtensions: [gfmFromMarkdown()],
  });
}

/** Remove script and style nodes from the tree. */
function removeEmbeddedCode(tree: MdastRoot): void {
  const toRemove: Array<{ parent: Node; index: number }> = [];

  visit(tree, ["script", "style"], (node, index, parent) => {
    if (parent && typeof index === "number") {
      toRemove.push({ parent, index });
    }
  });

  removeNodesByIndex(toRemove);
}

function isEmptyTextNode(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return false;
  const n = node as { type?: string; value?: string };
  return n.type === "text" && (n.value ?? "").trim().length === 0;
}

/** Check if a node contains only empty text. */
function hasOnlyEmptyText(node: unknown): boolean {
  const children = (node as { children?: unknown[] })?.children;
  if (!Array.isArray(children)) return true;
  for (const c of children) {
    if (!isEmptyTextNode(c)) return false;
  }
  return true;
}

/** Check if a node is an empty anchor link like [ ](#heading-id). */
function isEmptyAnchorLink(node: unknown): boolean {
  const n = node as { type?: string; url?: string };
  return (
    n.type === "link" && (n.url ?? "").startsWith("#") && hasOnlyEmptyText(node)
  );
}

/** Check if a text child should be kept in a surviving paragraph. */
function isNonEmptyContent(child: unknown): boolean {
  if (typeof child !== "object" || child === null) return false;
  const c = child as { type?: string; value?: string };
  if (c.type === "text") return (c.value ?? "").trim().length > 0;
  // Keep non-text nodes that have children (e.g. links, strong)
  return Array.isArray((child as { children?: unknown[] })?.children);
}

/** Remove empty anchor links from heading children. */
function cleanHeadings(tree: MdastRoot): void {
  visit(tree, "heading", (node) => {
    const heading = node as { children?: unknown[] };
    const children = heading.children;
    if (!Array.isArray(children)) return;
    heading.children = children.filter(
      (child): child is Node => !isEmptyAnchorLink(child),
    );
  });
}

/** Extract text content from paragraph children, including text inside links. */
function getParagraphText(
  children: Array<{ type?: string; value?: string }> | undefined,
): string {
  const parts: string[] = [];
  for (const c of children ?? []) {
    if (c.type === "text") {
      parts.push(c.value ?? "");
    } else {
      const nested = getParagraphText(
        (c as { children?: Array<{ type?: string; value?: string }> }).children,
      );
      if (nested) parts.push(nested);
    }
  }
  return parts.join("").trim();
}

/** Remove empty paragraphs and clean paragraph children. */
function cleanParagraphs(tree: MdastRoot): void {
  const toRemove: Array<{ parent: Node; index: number }> = [];

  visit(tree, "paragraph", (node, index, parent) => {
    const para = node as { children?: unknown[] };
    const children = para.children;
    if (!Array.isArray(children)) {
      if (parent && typeof index === "number") toRemove.push({ parent, index });
      return;
    }
    const fullText = getParagraphText(
      children as Array<{ type?: string; value?: string }>,
    );
    if (fullText.length === 0) {
      if (parent && typeof index === "number") toRemove.push({ parent, index });
    } else {
      const cleaned = children.filter(
        (child): child is Node =>
          isNonEmptyContent(child) && !isEmptyAnchorLink(child),
      );
      if (cleaned.length !== children.length) {
        para.children = cleaned;
      }
    }
  });

  removeNodesByIndex(toRemove);
}

/** Clean an mdast tree: remove scripts, styles, empty anchors, empty paragraphs. */
export function cleanTree(tree: MdastRoot): MdastRoot {
  removeEmbeddedCode(tree);
  cleanHeadings(tree);
  cleanParagraphs(tree);
  return tree;
}
