import { toMarkdown } from "mdast-util-to-markdown";
import { gfmToMarkdown } from "mdast-util-gfm";
import { visit } from "unist-util-visit";
import type { Node as UnistNode } from "unist";
import type { ParseResult } from "../../types";
import { createRetryFetchText } from "../../lib/parser-factory";
import { parseWikitext } from "../../lib/wikitext-parser";
import { cleanMdastTree } from "./tree-cleaning";
import { stripTemplatesAndCommentsFromTextNodes } from "./wikitext";

const wikiFetchText = createRetryFetchText({ apiName: "Wikipedia" });

function hasWikiError(json: { query?: { error?: unknown } }): boolean {
  return !!json.query?.["error"];
}

function getFirstRevision(
  pages: Record<string, { revisions?: Array<{ "*": string }> }>,
): string | null {
  const pageKey = Object.keys(pages)[0];
  const revisions = pages[pageKey]?.revisions;
  return revisions?.[0]?.["*"] ?? null;
}

function extractArticleRevision(
  wikitext: string,
): { rawWikitext: string } | { error: true } {
  const json = JSON.parse(wikitext) as {
    query?: {
      pages?: Record<string, { revisions?: Array<{ "*": string }> }>;
      error?: unknown;
    };
  };
  const revision = extractFirstRevision(json);
  if (!revision) return { error: true };
  return { rawWikitext: revision };
}

function extractFirstRevision(json: Record<string, unknown>): string | null {
  if (hasWikiError(json)) return null;
  const pages = (json as { query?: { pages?: unknown } }).query?.pages;
  if (!pages || typeof pages !== "object") return null;
  return getFirstRevision(
    pages as Record<string, { revisions?: Array<{ "*": string }> }>,
  );
}

export async function handleArticle(
  title: string,
  lang: string,
  signal?: AbortSignal,
): Promise<string> {
  const encoded = encodeURIComponent(title);
  const wikitext = await wikiFetchText(
    `https://${lang}.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&format=json&titles=${encoded}`,
    signal,
  );

  const result = extractArticleRevision(wikitext);
  if ("error" in result) {
    return renderArticleNotFound(title, lang);
  }
  let tree: ParseResult;
  try {
    tree = parseWikitext(result.rawWikitext);
  } catch {
    return result.rawWikitext;
  }

  if (typeof tree === "string") return tree;

  stripTemplatesAndCommentsFromTextNodes(tree as UnistNode);
  removeCommentHtmlNodes(tree as UnistNode);
  removeCategoriesFromTree(tree as UnistNode);
  cleanMdastTree(tree);
  return toMarkdown(tree, { extensions: [gfmToMarkdown()] });
}

function renderArticleNotFound(title: string, lang: string): string {
  return `# Article Not Found\n\nCould not find an article titled "${title}" on ${lang}.wikipedia.org.\n\nTry searching instead.`;
}

function hasChildrenArray(parent: unknown): parent is { children: unknown[] } {
  return (
    typeof parent === "object" &&
    parent !== null &&
    "children" in parent &&
    Array.isArray((parent as { children: unknown[] }).children)
  );
}

function removeNodesMatching<T extends UnistNode>(
  root: UnistNode,
  type: string,
  predicate: (node: T) => boolean,
): void {
  const toRemove: Array<{ parent: unknown; index: number }> = [];
  visit(root, type, (node, index, parent) => {
    if (!parent || typeof index !== "number") return;
    if (predicate(node as T)) {
      toRemove.push({ parent, index });
    }
  });
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const { parent, index } = toRemove[i];
    if (hasChildrenArray(parent)) {
      parent.children.splice(index, 1);
    }
  }
}

function removeCommentHtmlNodes(root: UnistNode): void {
  removeNodesMatching<UnistNode & { value: unknown }>(
    root,
    "html",
    (node) =>
      typeof node.value === "string" && /^<!--.*-->$/s.test(node.value.trim()),
  );
}

function removeCategoriesFromTree(root: UnistNode): void {
  removeNodesMatching<UnistNode & { url: unknown }>(root, "link", (node) => {
    const url = typeof node.url === "string" ? node.url : "";
    const lower = url.toLowerCase();
    return lower.startsWith("category:") || lower === "category";
  });
}
