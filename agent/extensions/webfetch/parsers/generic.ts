import type { Root as MdastRoot, Node, Html } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import type { Parser } from "../types";
import { htmlToMdast, isHtmlContent } from "../lib/html-parsing";
import { cleanTree } from "../lib/mdast-cleaner";
import { createRetryFetchText } from "../lib/parser-factory";
import { visit } from "unist-util-visit";

const fetchContent = createRetryFetchText({ apiName: "Generic" });

async function readLocalFile(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(path, "utf-8");
}
function removeNodeFromParent(parent: Node, index: number): void {
  const siblings = (parent as { children?: Node[] }).children;
  siblings?.splice(index, 1);
}

function replaceHtmlNode(
  htmlContent: string,
  parent: Node,
  index: number,
): void {
  const siblings = (parent as { children?: Node[] }).children;
  if (!siblings) return;

  try {
    const mdastTree = htmlToMdast(htmlContent);
    if (mdastTree.children.length > 0) {
      siblings.splice(index, 1, ...mdastTree.children);
      return;
    }
  } catch {
    // fall through to removal
  }
  removeNodeFromParent(parent, index);
}

function convertHtmlNodes(tree: MdastRoot): void {
  const htmlNodes: Array<{ node: Node; parent: Node; index: number }> = [];

  visit(tree, "html", (node, index, parent) => {
    if (parent && typeof index === "number") {
      htmlNodes.push({ node, parent, index });
    }
  });

  for (const { node, parent, index } of htmlNodes) {
    const htmlContent = (node as Html).value;
    replaceHtmlNode(htmlContent, parent, index);
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
async function fetchSourceContent(
  source: string,
  signal?: AbortSignal,
): Promise<string> {
  if (/^https?:\/\//i.test(source)) {
    return fetchContent(source, signal);
  }
  return readLocalFile(source);
}

function parseContentToTree(content: string): MdastRoot {
  try {
    if (isHtmlContent(content)) {
      return htmlToMdast(content);
    }
    const tree = fromMarkdown(content, undefined, {
      mdastExtensions: [gfmFromMarkdown()],
    });
    convertHtmlNodes(tree);
    return tree;
  } catch {
    if (isHtmlContent(content)) {
      const text = extractTextFromHtml(content);
      return fromMarkdown(text, undefined, {
        mdastExtensions: [gfmFromMarkdown()],
      });
    }
    throw new Error("Parsing failed: " + content.slice(0, 200));
  }
}

export const genericParser: Parser = {
  matches(): boolean {
    return true;
  },

  async convert(source: string, signal?: AbortSignal): Promise<MdastRoot> {
    const content = await fetchSourceContent(source, signal);
    const tree = parseContentToTree(content);
    return cleanTree(tree);
  },
};
