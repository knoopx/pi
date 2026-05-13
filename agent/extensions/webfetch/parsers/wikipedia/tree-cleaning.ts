import { visit } from "unist-util-visit";
import type { Node as UnistNode } from "unist";
import type { ParseResult } from "../../types";
import { removeNodesByIndex } from "../../lib/tree-utils";

function hasInnerText(children: unknown[]): boolean {
  for (const gc of children) {
    if (typeof gc !== "object" || !gc) continue;
    const g = gc as { type?: string; url?: string };
    if (g.type !== "image" || g.url) return true;
  }
  return false;
}

function checkChild(child: unknown): boolean {
  if (typeof child !== "object" || !child) return false;
  const c = child as { type?: string; value?: string; children?: unknown[] };
  if (c.type === "text") return (c.value ?? "").trim().length > 0;
  if (c.type === "image") return false;
  if (!Array.isArray(c.children)) return false;
  return hasInnerText(c.children);
}

function hasTextContent(children: unknown[]): boolean {
  if (!children || children.length === 0) return false;
  for (const child of children) {
    if (checkChild(child)) return true;
  }
  return false;
}

function stripCitationMarkers(raw: string): string {
  const parts: string[] = [];
  let start = 0;

  for (let i = 0; i < raw.length - 2; i++) {
    if (raw[i] === "[" && raw[i + 1] === "\\" && raw[i + 2] === "[") {
      if (i > start) parts.push(raw.slice(start, i));
      const closeIdx = raw.indexOf("]]", i + 3);
      if (closeIdx !== -1) {
        i = closeIdx + 1;
        start = i;
      }
    }
  }
  if (start < raw.length) parts.push(raw.slice(start));

  return parts.join("");
}

function cleanCitationMarkers(tree: ParseResult): void {
  if (typeof tree === "string") return;
  visit(tree as UnistNode, "text", (node, index, parent) => {
    if (!parent || typeof index !== "number") return;
    const textNode = node as { value?: string };
    const cleaned = stripCitationMarkers(textNode.value ?? "");
    if (cleaned === textNode.value) return;
    applyCitationFix(parent, index, cleaned);
  });
}

function applyCitationFix(
  parent: unknown,
  index: number,
  cleaned: string,
): void {
  if (
    typeof parent !== "object" ||
    parent === null ||
    !("children" in parent)
  ) {
    return;
  }
  const children = (parent as { children?: unknown[] }).children;
  if (!Array.isArray(children) || index < 0 || index >= children.length) return;
  if (cleaned.trim().length === 0) {
    children.splice(index, 1);
  } else {
    children[index] = { type: "text", value: cleaned };
  }
}

function isRemovedSection(title: string): boolean {
  const lower = title.toLowerCase();
  return (
    lower.includes("references") ||
    lower.includes("external links") ||
    lower.includes("see also") ||
    lower.includes("notes")
  );
}

export function cleanMdastTree(tree: ParseResult): void {
  const toRemove: Array<{ parent: unknown; index: number }> = [];
  visit(tree as UnistNode, "paragraph", (node, index, parent) => {
    if (!parent || typeof index !== "number") return;
    const para = node as { children?: unknown[] };
    if (!hasTextContent(para.children ?? [])) {
      toRemove.push({
        parent: parent as UnistNode,
        index,
      });
    }
  });

  removeNodesByIndex(toRemove as Array<{ parent: UnistNode; index: number }>);
  cleanCitationMarkers(tree);
  visit(tree as UnistNode, "heading", (node, index, parent) => {
    if (!parent || typeof index !== "number") return;
    const heading = node as { children?: unknown[] };
    const title = getHeadingText(heading);
    if (isRemovedSection(title)) {
      toRemove.push({
        parent: parent as UnistNode,
        index,
      });
    }
  });

  removeNodesByIndex(toRemove as Array<{ parent: UnistNode; index: number }>);
}

function getHeadingText(heading: { children?: unknown[] }): string {
  const parts: string[] = [];
  for (const child of heading.children ?? []) {
    if (typeof child === "object" && child !== null) {
      const c = child as { type?: string; value?: string };
      if (c.type === "text") parts.push(c.value ?? "");
    }
  }
  return parts.join("").trim();
}
