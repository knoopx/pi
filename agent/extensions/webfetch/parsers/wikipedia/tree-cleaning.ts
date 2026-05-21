import { visit } from "unist-util-visit";
import type { Node as UnistNode } from "unist";
import type { ParseResult } from "../../types";
import { removeNodesByIndex } from "../../lib/tree-mutation";
import { cleanCitationMarkers } from "./citation";

function isMeaningfulNode(node: { type?: string; url?: string }): boolean {
  if (node.type === "image") return !!node.url;
  return node.type !== "image";
}

function isMeaningfulChild(gc: unknown): boolean {
  if (typeof gc !== "object" || !gc) return false;
  return isMeaningfulNode(gc as { type?: string; url?: string });
}

function hasInnerText(children: unknown[]): boolean {
  for (const gc of children) {
    if (isMeaningfulChild(gc)) return true;
  }
  return false;
}

function isNonEmptyTextNode(child: { type?: string; value?: string }): boolean {
  return child.type === "text" && (child.value ?? "").trim().length > 0;
}

function toChildObject(
  child: unknown,
): { type?: string; value?: string; children?: unknown[] } | null {
  if (typeof child !== "object" || !child) return null;
  return child as { type?: string; value?: string; children?: unknown[] };
}

function checkChild(child: unknown): boolean {
  const c = toChildObject(child);
  if (!c) return false;
  if (isNonEmptyTextNode(c)) return true;
  return c.type !== "image" && hasInnerContent(c.children ?? []);
}

function hasInnerContent(children: unknown[]): boolean {
  return Array.isArray(children) && hasInnerText(children);
}

function hasTextContent(children: unknown[]): boolean {
  if (!children.length) return false;
  for (const child of children) {
    if (checkChild(child)) return true;
  }
  return false;
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

function isNonNullObject(child: unknown): boolean {
  return typeof child === "object" && child !== null;
}

function extractTextFromChild(child: unknown): string | null {
  if (!isNonNullObject(child)) return null;
  const c = child as { type?: string; value?: string };
  return c.type === "text" ? (c.value ?? "") : null;
}

function getHeadingText(heading: { children?: unknown[] }): string {
  const parts: string[] = [];
  for (const child of heading.children ?? []) {
    const text = extractTextFromChild(child);
    if (text !== null) parts.push(text);
  }
  return parts.join("").trim();
}
