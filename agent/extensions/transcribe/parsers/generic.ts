import type { Root as MdastRoot, Node } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import type { Parser } from "../lib/types";
import { htmlToMdast, isHtmlContent } from "../lib/html-utils";
import { cleanTree } from "../lib/mdast-utils";
import { fetchWithRetry } from "../lib/retry";
import { BROWSER_HEADERS } from "../lib/constants";
import { visit } from "unist-util-visit";

async function fetchContent(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetchWithRetry(url, { headers: BROWSER_HEADERS, signal });
  return res.text();
}

async function readLocalFile(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf-8");
}

// Convert mdast "html" nodes to proper markdown equivalents.
// This handles README content that has inline HTML mixed with markdown.
function convertHtmlNodes(tree: MdastRoot): void {
  const htmlNodes: Array<{ node: Node; parent: Node; index: number }> = [];

  visit(tree, "html", (node, index, parent) => {
    if (parent && typeof index === "number") {
      htmlNodes.push({ node, parent, index });
    }
  });

  for (const { node, parent, index } of htmlNodes) {
    const htmlContent = (node as unknown as { value: string }).value;
    try {
      // Use hast-util-to-mdast to convert HTML fragment to mdast nodes
      const mdastTree = htmlToMdast(htmlContent);
      const siblings = (parent as { children?: Node[] }).children;
      if (siblings) {
        if (mdastTree.children.length > 0) {
          siblings.splice(index, 1, ...mdastTree.children);
        } else {
          // Empty HTML node — remove it
          siblings.splice(index, 1);
        }
      }
    } catch {
      // If conversion fails, remove the problematic HTML node
      const siblings = (parent as { children?: Node[] }).children;
      if (siblings) {
        siblings.splice(index, 1);
      }
    }
  }
}

function extractTextFromHtml(html: string): string {
  // Strip script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  // Strip HTML tags, keeping line breaks for paragraphs
  text = text.replace(/<\/?br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  // Decode HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  // Collapse whitespace
  text = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
  return text;
}

export const parser: Parser = {
  matches(): boolean {
    return true;
  },

  async convert(source: string, signal?: AbortSignal): Promise<MdastRoot> {
    let content: string;

    if (/^https?:\/\//i.test(source)) {
      content = await fetchContent(source, signal);
    } else {
      content = await readLocalFile(source);
    }

    let tree: MdastRoot;

    try {
      if (isHtmlContent(content)) {
        // Content looks like a full HTML document — parse as HTML
        tree = htmlToMdast(content);
      } else {
        // Markdown content, possibly with inline HTML fragments
        tree = fromMarkdown(content, undefined, {
          mdastExtensions: [gfmFromMarkdown()],
        });
        // Convert any inline HTML nodes (common in READMEs) to markdown
        convertHtmlNodes(tree);
      }
    } catch {
      // If structured parsing fails, fall back to text extraction for HTML
      if (isHtmlContent(content)) {
        const text = extractTextFromHtml(content);
        return fromMarkdown(text, undefined, {
          mdastExtensions: [gfmFromMarkdown()],
        });
      }
      throw new Error("Parsing failed: " + content.slice(0, 200));
    }

    return cleanTree(tree);
  },
};
