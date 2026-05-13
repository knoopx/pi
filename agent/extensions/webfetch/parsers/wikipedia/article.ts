import { toMarkdown } from "mdast-util-to-markdown";
import { gfmToMarkdown } from "mdast-util-gfm";
import { visit } from "unist-util-visit";
import type { Node as UnistNode } from "unist";
import type { ParseResult } from "../../types";
import { createRetryFetchText } from "../../lib/parser-utils";
import { parseWikitext as wikitextToMdast } from "../../lib/wikitext-parser";
import { cleanMdastTree } from "./tree-cleaning";

const wikiFetchText = createRetryFetchText({ apiName: "Wikipedia" });

function extractArticleRevision(
  wikitext: string,
): { rawWikitext: string } | { error: true } {
  const json = JSON.parse(wikitext) as {
    query?: {
      pages?: Record<string, { revisions?: Array<{ "*": string }> }>;
      error?: unknown;
    };
  };

  if (json.query?.["error"]) return { error: true };

  const pages = json.query?.pages;
  if (!pages) return { error: true };

  const pageKey = Object.keys(pages)[0];
  const revisions = pages[pageKey]?.revisions;
  if (!revisions?.length) return { error: true };

  return { rawWikitext: revisions[0]["*"] };
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
    tree = wikitextToMdast(result.rawWikitext);
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

const stripTemplatesAndCommentsFromTextNodes =
  stripTemplateAndCommentTextFromTextNodes;

function stripTemplateAndCommentTextFromTextNodes(root: UnistNode): void {
  visit(root, "text", (node, index, parent) => {
    if (!parent || typeof index !== "number") return;
    const textNode = node as { value?: string };
    if (!textNode.value) return;

    const cleaned = stripWikitextTemplates(textNode.value);
    if (cleaned !== textNode.value) {
      const children = (parent as { children: unknown[] }).children;
      if (Array.isArray(children)) {
        children[index] = { type: "text", value: cleaned };
      }
    }
  });
}

function skipTemplate(text: string, start: number): number {
  let depth = 2;
  let i = start;
  while (i < text.length && depth > 0) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") depth--;
    i++;
  }
  return i;
}

function skipComment(text: string, start: number): number {
  let i = start;
  while (i < text.length) {
    if (text[i] === "-" && text[i + 1] === "-" && text[i + 2] === ">") {
      return i + 3;
    }
    i++;
  }
  return i;
}

function stripWikitextTemplates(text: string): string {
  let result = "";
  let i = 0;

  while (i < text.length) {
    if (text[i] === "{" && text[i + 1] === "{") {
      i = skipTemplate(text, i + 2);
    } else if (
      text[i] === "<" &&
      text[i + 1] === "!" &&
      text[i + 2] === "-" &&
      text[i + 3] === "-"
    ) {
      i = skipComment(text, i + 4);
    } else {
      result += text[i];
      i++;
    }
  }

  return result;
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
    if (
      typeof parent === "object" &&
      parent !== null &&
      "children" in parent &&
      Array.isArray((parent as { children: unknown[] }).children)
    ) {
      (parent as { children: unknown[] }).children.splice(index, 1);
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
