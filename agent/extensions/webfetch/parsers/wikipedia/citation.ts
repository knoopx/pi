import { visit } from "unist-util-visit";
import type { Node as UnistNode } from "unist";
import type { ParseResult } from "../../types";

function isCitationStart(raw: string, i: number): boolean {
  return raw[i] === "[" && raw[i + 1] === "\\" && raw[i + 2] === "[";
}

function findCitationEnd(raw: string, startIdx: number): number {
  const closeIdx = raw.indexOf("]]", startIdx);
  return closeIdx !== -1 ? closeIdx + 1 : -1;
}

function processCitation(
  raw: string,
  i: number,
  start: number,
  parts: string[],
): { end: number; newStart: number } {
  if (i > start) parts.push(raw.slice(start, i));
  const end = findCitationEnd(raw, i + 3);
  return end !== -1 ? { end, newStart: end } : { end: -1, newStart: i };
}

function stripCitationMarkers(raw: string): string {
  const parts: string[] = [];
  let start = 0;

  for (let i = 0; i < raw.length - 2; i++) {
    if (!isCitationStart(raw, i)) continue;
    const { end, newStart } = processCitation(raw, i, start, parts);
    if (end !== -1) {
      i = end;
      start = newStart;
    }
  }
  appendRemaining(raw, start, parts);

  return parts.join("");
}

function appendRemaining(raw: string, start: number, parts: string[]): void {
  if (start < raw.length) parts.push(raw.slice(start));
}

function isParentWithChildren(parent: unknown): boolean {
  return typeof parent === "object" && parent !== null && "children" in parent;
}

function validateParent(parent: unknown): { children: unknown[] } | null {
  if (!isParentWithChildren(parent)) return null;
  const children = (parent as { children?: unknown[] }).children;
  if (!Array.isArray(children)) return null;
  return { children };
}

function getValidatedChildren(
  parent: unknown,
  index: number,
): { children: unknown[]; index: number } | null {
  const result = validateParent(parent);
  if (!result || index < 0 || index >= result.children.length) return null;
  return { children: result.children, index };
}

function applyCitationFix(
  parent: unknown,
  index: number,
  cleaned: string,
): void {
  const result = getValidatedChildren(parent, index);
  if (!result) return;
  if (cleaned.trim().length === 0) {
    result.children.splice(result.index, 1);
  } else {
    result.children[result.index] = { type: "text", value: cleaned };
  }
}

function handleTextCleaning(
  node: UnistNode,
  index: number | null,
  parent: unknown,
): void {
  if (!parent || typeof index !== "number") return;
  const textNode = node as { value?: string };
  const cleaned = stripCitationMarkers(textNode.value ?? "");
  if (cleaned === textNode.value) return;
  applyCitationFix(parent, index, cleaned);
}

export function cleanCitationMarkers(tree: ParseResult): void {
  if (typeof tree === "string") return;
  visit(tree as UnistNode, "text", (node, index, parent) => {
    handleTextCleaning(node, index, parent);
  });
}
