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
      const mdastTree = htmlToMdast(htmlContent);
      const siblings = (parent as { children?: Node[] }).children;
      if (siblings) {
        if (mdastTree.children.length > 0) {
          siblings.splice(index, 1, ...mdastTree.children);
        } else {
          siblings.splice(index, 1);
        }
      }
    } catch {
      const siblings = (parent as { children?: Node[] }).children;
      if (siblings) {
        siblings.splice(index, 1);
      }
    }
  }
}
function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<\/?br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?(p|div|h[1-6]|li|tr)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  text = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
  return text;
}
export const genericParser: Parser = {
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
        tree = htmlToMdast(content);
      } else {
        tree = fromMarkdown(content, undefined, {
          mdastExtensions: [gfmFromMarkdown()],
        });
        convertHtmlNodes(tree);
      }
    } catch {
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
