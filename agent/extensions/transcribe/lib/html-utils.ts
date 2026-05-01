import type { Root as HastRoot } from "hast";
import type { Root as MdastRoot } from "mdast";
import type { Node } from "unist";
import { fromHtml } from "hast-util-from-html";
import { removeNodesByIndex } from "./tree-utils";
import { toMdast } from "hast-util-to-mdast";
import { visit } from "unist-util-visit";
const README_HTML_TAGS =
  /<(img|table|thead|tbody|tfoot|tr|th|td|div|span|pre|code|blockquote|hr)/i;
export function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  if (/^<(html|head|body|!doctype)/i.test(trimmed.slice(0, 1024))) return true;
  return README_HTML_TAGS.test(content);
}
export function stripHtmlComments(html: string): string {
  return html.replace(/<!--[^]*?-->/g, () => " ");
}
const CHROME_ELEMENTS = new Set([
  "nav",
  "header",
  "footer",
  "aside",
  "form",
  "select",
  "noscript",
]);
function isChromeElement(node: Node): boolean {
  const el = node as { tagName?: string };
  return !!(el.tagName && CHROME_ELEMENTS.has(el.tagName.toLowerCase()));
}
function removeChromeElements(tree: HastRoot): void {
  const toRemove: Array<{ parent: Node; index: number }> = [];

  visit(tree, "element", (node, index, parent) => {
    if (isChromeElement(node) && parent && typeof index === "number") {
      toRemove.push({ parent, index });
    }
  });

  removeNodesByIndex(toRemove);
}
export function htmlToMdast(html: string): MdastRoot {
  const cleanHtml = stripHtmlComments(html);
  const hast: HastRoot = fromHtml(cleanHtml);
  removeChromeElements(hast);
  return toMdast(hast) as MdastRoot;
}
