import type { Root as MdastRoot } from "mdast";
import type { Node } from "unist";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { removeNodesByIndex } from "./tree-utils";
import { fromMarkdown } from "mdast-util-from-markdown";
import { visit } from "unist-util-visit";
export function markdownToMdast(text: string): MdastRoot {
  return fromMarkdown(text, undefined, {
    mdastExtensions: [gfmFromMarkdown()],
  });
}
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
function hasOnlyEmptyText(node: unknown): boolean {
  const children = (node as { children?: unknown[] })?.children;
  if (!Array.isArray(children)) return true;
  for (const c of children) {
    if (!isEmptyTextNode(c)) return false;
  }
  return true;
}
function isAnchorLink(node: unknown): boolean {
  const n = node as { type?: string; url?: string };
  return n.type === "link" && (n.url ?? "").startsWith("#");
}
function isEmptyListItem(node: unknown): boolean {
  const n = node as { children?: unknown[] };
  const children = n.children;
  if (!Array.isArray(children) || children.length === 0) return true;
  for (const child of children) {
    const c = child as { type?: string; children?: unknown[] };
    if (c.type === "paragraph" && !hasOnlyEmptyText(c)) return false;
    if (c.type !== "paragraph") return false;
  }
  return true;
}
function cleanLists(tree: MdastRoot): void {
  const toRemoveItems: Array<{ parent: Node; index: number }> = [];
  visit(tree, "listItem", (node, index, parent) => {
    if (parent && typeof index === "number" && isEmptyListItem(node)) {
      toRemoveItems.push({ parent, index });
    }
  });
  removeNodesByIndex(toRemoveItems);

  const toRemoveLists: Array<{ parent: Node; index: number }> = [];
  visit(tree, "list", (node, index, parent) => {
    const listNode = node as { children?: unknown[] };
    if (
      parent &&
      typeof index === "number" &&
      (!listNode.children || listNode.children.length === 0)
    ) {
      toRemoveLists.push({ parent, index });
    }
  });
  removeNodesByIndex(toRemoveLists);
}
function isNonEmptyContent(child: unknown): boolean {
  if (typeof child !== "object" || child === null) return false;
  const c = child as { type?: string; value?: string };
  if (c.type === "text") return (c.value ?? "").trim().length > 0;
  return Array.isArray((child as { children?: unknown[] })?.children);
}
function removeAnchorLinks(tree: MdastRoot): void {
  const toRemove: Array<{ parent: Node; index: number }> = [];

  visit(tree, "link", (node, index, parent) => {
    if (isAnchorLink(node) && parent && typeof index === "number") {
      toRemove.push({ parent, index });
    }
  });

  removeNodesByIndex(toRemove);
}
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
      const cleaned = children.filter((child): child is Node =>
        isNonEmptyContent(child),
      );
      if (cleaned.length !== children.length) {
        para.children = cleaned;
      }
    }
  });

  removeNodesByIndex(toRemove);
}
export function cleanTree(tree: MdastRoot): MdastRoot {
  removeEmbeddedCode(tree);
  removeAnchorLinks(tree);
  cleanParagraphs(tree);
  cleanLists(tree);
  return tree;
}
