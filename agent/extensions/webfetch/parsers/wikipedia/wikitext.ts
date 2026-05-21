import { visit } from "unist-util-visit";
import type { Node as UnistNode } from "unist";

function skipTemplate(text: string, start: number): number {
  let depth = 2;
  let i = start;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return i;
}

function skipComment(text: string, start: number): number {
  let i = start;
  while (i < text.length) {
    if (isCommentEnd(text, i)) return i + 3;
    i++;
  }
  return i;
}

function isCommentEnd(text: string, pos: number): boolean {
  return text[pos] === "-" && text[pos + 1] === "-" && text[pos + 2] === ">";
}

function startsWithTemplate(text: string, pos: number): boolean {
  return text[pos] === "{" && text[pos + 1] === "{";
}

function startsWithComment(text: string, pos: number): boolean {
  return (
    text[pos] === "<" &&
    text[pos + 1] === "!" &&
    text[pos + 2] === "-" &&
    text[pos + 3] === "-"
  );
}

function stripWikitextTemplates(text: string): string {
  let result = "";
  let i = 0;

  while (i < text.length) {
    if (startsWithTemplate(text, i)) {
      i = skipTemplate(text, i + 2);
    } else if (startsWithComment(text, i)) {
      i = skipComment(text, i + 4);
    } else {
      result += text[i];
      i++;
    }
  }

  return result;
}

function updateTextNode(node: unknown, index: unknown, parent: unknown): void {
  if (!parent || typeof index !== "number") return;
  const textNode = node as { value?: string };
  if (!textNode.value) return;
  const cleaned = stripWikitextTemplates(textNode.value);
  if (cleaned !== textNode.value) {
    applyCleanedText(parent, index, cleaned);
  }
}

function applyCleanedText(
  parent: object,
  index: number,
  cleaned: string,
): void {
  const children = (parent as { children: unknown[] }).children;
  if (Array.isArray(children)) {
    children[index] = { type: "text", value: cleaned };
  }
}

export function stripTemplatesAndCommentsFromTextNodes(root: UnistNode): void {
  visit(root, "text", (node, index, parent) => {
    updateTextNode(node, index, parent);
  });
}
