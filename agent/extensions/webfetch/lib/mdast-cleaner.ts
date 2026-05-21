import type { Root as MdastRoot } from "mdast";
import type { Node } from "unist";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { removeNodesByIndex } from "./tree-mutation";
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
function isNonNullObject(node: unknown): boolean {
  return typeof node === "object" && node !== null;
}

function isEmptyTextNode(node: unknown): boolean {
  if (!isNonNullObject(node)) return false;
  const n = node as { type?: string; value?: string };
  return isTextWithEmptyValue(n);
}

function isTextWithEmptyValue(n: { type?: string; value?: string }): boolean {
  return n.type === "text" && (n.value ?? "").trim().length === 0;
}
function getChildren(node: unknown): unknown[] | null {
  const result = (node as { children?: unknown[] })?.children;
  return Array.isArray(result) ? result : null;
}

function hasOnlyEmptyText(node: unknown): boolean {
  const children = getChildren(node);
  if (!children) return true;
  for (const c of children) {
    if (!isEmptyTextNode(c)) return false;
  }
  return true;
}
function isAnchorLink(node: unknown): boolean {
  const n = node as { type?: string; url?: string };
  return n.type === "link" && (n.url ?? "").startsWith("#");
}
function isParagraph(child: unknown): boolean {
  return (child as { type?: string }).type === "paragraph";
}

function hasNonEmptyParagraph(children: unknown[]): boolean {
  for (const child of children) {
    if (!isParagraph(child)) return false;
    if (!hasOnlyEmptyText(child)) return true;
  }
  return false;
}

function isEmptyListItem(node: unknown): boolean {
  const n = node as { children?: unknown[] };
  const children = n.children;
  if (!Array.isArray(children) || children.length === 0) return true;
  return !hasNonEmptyParagraph(children);
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
    if (parent && typeof index === "number" && isEmptyList(node)) {
      toRemoveLists.push({ parent, index });
    }
  });

  function isEmptyList(node: unknown): boolean {
    const listNode = node as { children?: unknown[] };
    return !listNode.children || listNode.children.length === 0;
  }
  removeNodesByIndex(toRemoveLists);
}
function hasTextContent(c: { value?: string }): boolean {
  return (c.value ?? "").trim().length > 0;
}

function isNonEmptyContent(child: unknown): boolean {
  if (!isNonNullObject(child)) return false;
  const c = child as { type?: string; value?: string };
  if (c.type === "text") return hasTextContent(c);
  return hasChildren(child);
}

function hasChildren(node: unknown): boolean {
  return Array.isArray((node as { children?: unknown[] })?.children);
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
function extractTextFromChild(c: {
  type?: string;
  value?: string;
}): string | null {
  if (c.type === "text") return c.value ?? "";
  const nested = getParagraphText(
    (c as { children?: Array<{ type?: string; value?: string }> }).children,
  );
  return nested || null;
}

function getParagraphText(
  children: Array<{ type?: string; value?: string }> | undefined,
): string {
  const parts: string[] = [];
  for (const c of children ?? []) {
    const text = extractTextFromChild(c);
    if (text) parts.push(text);
  }
  return parts.join("").trim();
}
function shouldScheduleRemoval(
  parent: unknown,
  index: unknown,
): { parent: Node; index: number } | null {
  if (parent && typeof index === "number")
    return { parent: parent as Node, index };
  return null;
}

function cleanParagraphs(tree: MdastRoot): void {
  const toRemove: Array<{ parent: Node; index: number }> = [];

  visit(tree, "paragraph", (node, index, parent) => {
    const para = node as { children?: unknown[] };
    if (isInvalidChildren(para)) {
      scheduleRemoval(parent, index, toRemove);
      return;
    }
    const children = para.children as unknown[];
    const fullText = getParagraphText(
      children as Array<{ type?: string; value?: string }>,
    );
    if (fullText.length === 0) {
      scheduleRemoval(parent, index, toRemove);
      return;
    }
    const cleaned = children.filter((child): child is Node =>
      isNonEmptyContent(child),
    );
    if (cleaned.length !== children.length) {
      para.children = cleaned;
    }
  });

  function isInvalidChildren(para: { children?: unknown[] }): boolean {
    return !para.children || !Array.isArray(para.children);
  }

  removeNodesByIndex(toRemove);
}

function scheduleRemoval(
  parent: unknown,
  index: unknown,
  toRemove: Array<{ parent: Node; index: number }>,
): void {
  const removal = shouldScheduleRemoval(parent, index);
  if (removal) toRemove.push(removal);
}
export function cleanTree(tree: MdastRoot): MdastRoot {
  removeEmbeddedCode(tree);
  removeAnchorLinks(tree);
  cleanParagraphs(tree);
  cleanLists(tree);
  return tree;
}
