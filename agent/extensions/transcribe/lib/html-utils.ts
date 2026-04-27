import type { Root as HastRoot } from "hast";
import type { Root as MdastRoot } from "mdast";
import type { Node } from "unist";
import { fromHtml } from "hast-util-from-html";
import { removeNodesByIndex } from "./tree-utils.js";
import { toMdast } from "hast-util-to-mdast";
import { visit } from "unist-util-visit";

// Common HTML tags that can appear in README markdown (GitHub/HuggingFace).
const README_HTML_TAGS =
  /<(img|table|thead|tbody|tfoot|tr|th|td|div|span|pre|code|blockquote|hr)/i;

export function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  // Full HTML documents
  if (/^<(html|head|body|!doctype)/i.test(trimmed.slice(0, 1024))) return true;
  // Inline HTML that can appear in README markdown (GitHub/HuggingFace)
  return README_HTML_TAGS.test(content);
}

// Strip HTML comments (including SPA hydration markers like <!--[0-->)
// before parsing so they never enter the AST.
export function stripHtmlComments(html: string): string {
  return html.replace(/<!--[^]*?-->/g, () => " ");
}

// Structural elements that are UI chrome and should be removed from the HAST tree.
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
