import { toMarkdown } from "mdast-util-to-markdown";
import { gfmToMarkdown } from "mdast-util-gfm";
import { createRetryFetchText } from "../lib/parser-utils";
import type { Parser, ParseResult } from "../lib/types";
import { removeNodesByIndex } from "../lib/tree-utils";
import { visit } from "unist-util-visit";
import type { Node as UnistNode } from "unist";
import { wikitextToMdast } from "../lib/wikitext-to-mdast";

type WikiPathType = "article" | "search";

interface WikiPath {
  type: WikiPathType;
  title?: string;
  query?: string;
  lang: string;
  limit?: number;
}

function buildSearchResult(
  searchParams: URLSearchParams,
  lang: string,
  searchKey: string = "search",
): WikiPath | null {
  const search = searchParams.get(searchKey) ?? searchParams.get("title") ?? "";
  if (!search || searchParams.get("action")) return null;
  const limit = parseInt(searchParams.get("limit") ?? "10", 10);
  return {
    type: "search",
    query: decodeURIComponent(search),
    lang,
    limit: isNaN(limit) ? 10 : limit,
  };
}

function parseWikiUrl(url: string): WikiPath | null {
  const match = url.match(/^https?:\/\/([a-z]{2})\.wikipedia\.org\/(.+)$/i);
  if (!match) return null;
  const lang = match[1].toLowerCase();
  const rest = match[2].replace(/\/+$/, "");
  if (!rest) return null;
  const articleResult = tryParseArticlePath(rest, lang);
  if (articleResult) return articleResult;
  const wikiSearchResult = tryParseWikiSearch(rest, lang);
  if (wikiSearchResult) return wikiSearchResult;

  return null;
}

function tryParseArticlePath(rest: string, lang: string): WikiPath | null {
  const match = rest.match(/^wiki\/(.+)$/);
  if (!match) return null;
  return {
    type: "article",
    title: decodeURIComponent(match[1].replace(/_/g, " ")),
    lang,
  };
}

function tryParseWikiSearch(rest: string, lang: string): WikiPath | null {
  const prefix = rest.startsWith("w/index.php")
    ? "w/index.php/"
    : rest.startsWith("wiki/Special:Search")
      ? "wiki/Special:Search/"
      : null;
  if (!prefix) return null;
  const searchParams = new URLSearchParams(rest.replace(prefix, ""));
  return buildSearchResult(searchParams, lang);
}

const wikiFetchText = createRetryFetchText({ apiName: "Wikipedia" });

function hasInnerText(children: unknown[]): boolean {
  for (const gc of children) {
    if (typeof gc !== "object" || !gc) continue;
    const g = gc as { type?: string; url?: string };
    if (g.type !== "image" || g.url) return true;
  }
  return false;
}

function checkChild(child: unknown): boolean {
  if (typeof child !== "object" || !child) return false;
  const c = child as { type?: string; value?: string; children?: unknown[] };
  if (c.type === "text") return (c.value ?? "").trim().length > 0;
  if (c.type === "image") return false;
  if (!Array.isArray(c.children)) return false;
  return hasInnerText(c.children);
}

function hasTextContent(children: unknown[]): boolean {
  if (!children || children.length === 0) return false;
  for (const child of children) {
    if (checkChild(child)) return true;
  }
  return false;
}

function stripCitationMarkers(raw: string): string {
  const parts: string[] = [];
  let start = 0;

  for (let i = 0; i < raw.length - 2; i++) {
    if (raw[i] === "[" && raw[i + 1] === "\\" && raw[i + 2] === "[") {
      if (i > start) parts.push(raw.slice(start, i));
      const closeIdx = raw.indexOf("]]", i + 3);
      if (closeIdx !== -1) {
        i = closeIdx + 1;
        start = i;
      }
    }
  }
  if (start < raw.length) parts.push(raw.slice(start));

  return parts.join("");
}

function cleanCitationMarkers(tree: ParseResult): void {
  if (typeof tree === "string") return;
  visit(tree as UnistNode, "text", (node, index, parent) => {
    if (!parent || typeof index !== "number") return;
    const textNode = node as { value?: string };
    const cleaned = stripCitationMarkers(textNode.value ?? "");
    if (cleaned === textNode.value) return;
    applyCitationFix(parent, index, cleaned);
  });
}

function applyCitationFix(
  parent: unknown,
  index: number,
  cleaned: string,
): void {
  if (
    typeof parent !== "object" ||
    parent === null ||
    !("children" in parent)
  ) {
    return;
  }
  const children = (parent as { children?: unknown[] }).children;
  if (!Array.isArray(children) || index < 0 || index >= children.length) return;
  if (cleaned.trim().length === 0) {
    children.splice(index, 1);
  } else {
    children[index] = { type: "text", value: cleaned };
  }
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

function cleanMdastTree(tree: ParseResult): void {
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

function getHeadingText(heading: { children?: unknown[] }): string {
  const parts: string[] = [];
  for (const child of heading.children ?? []) {
    if (typeof child === "object" && child !== null) {
      const c = child as { type?: string; value?: string };
      if (c.type === "text") parts.push(c.value ?? "");
    }
  }
  return parts.join("").trim();
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

  if (json.query?.["error"]) return { error: true };

  const pages = json.query?.pages;
  if (!pages) return { error: true };

  const pageKey = Object.keys(pages)[0];
  const revisions = pages[pageKey]?.revisions;
  if (!revisions?.length) return { error: true };

  return { rawWikitext: revisions[0]["*"] };
}

async function handleArticle(
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

  cleanMdastTree(tree);
  return toMarkdown(tree, { extensions: [gfmToMarkdown()] });
}

function renderArticleNotFound(title: string, lang: string): string {
  return `# Article Not Found\n\nCould not find an article titled "${title}" on ${lang}.wikipedia.org.\n\nTry searching instead.`;
}

interface SearchResult {
  title: string;
  snippet?: string;
  size?: number;
  timestamp?: number;
  pageid?: number;
}

async function handleSearch(
  query: string,
  lang: string,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  const clamped = Math.max(1, Math.min(limit, 30));
  const encoded = encodeURIComponent(query);
  const data = (await wikiFetchText(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=${clamped}&format=json&utf8=1`,
    signal,
  )) as { query?: { search?: SearchResult[] } };
  const results = data?.query?.search;
  if (!results?.length) {
    return `# Wikipedia Search: "${query}"\n\nNo articles found. Try a different search term.`;
  }
  const parts: string[] = [
    `# Wikipedia — "${query}"`,
    "",
    `${results.length} result(s)`,
  ];

  for (const r of results) {
    parts.push("", ...renderSearchResult(r, lang));
  }

  return parts.join("\n");
}

function renderSearchResult(r: SearchResult, lang: string): string[] {
  const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`;
  const lines: string[] = [`## [${r.title}](${pageUrl})`, ""];

  if (r.snippet) {
    // Strip HTML tags from snippet using simple string operations
    let clean = "";
    let inTag = false;
    for (const ch of r.snippet) {
      if (ch === "<") inTag = true;
      else if (ch === ">") inTag = false;
      else if (!inTag) clean += ch;
    }
    lines.push(clean);
  }

  return lines;
}

async function convertWikiPath(
  path: WikiPath,
  signal?: AbortSignal,
): Promise<string> {
  switch (path.type) {
    case "article":
      if (!path.title) throw new Error("Missing Wikipedia article title");
      return handleArticle(path.title, path.lang, signal);
    case "search":
      return handleSearch(
        path.query ?? "",
        path.lang,
        path.limit ?? 10,
        signal,
      );
  }
}

export const wikipediaParser: Parser = {
  matches(url: string): boolean {
    return /^https?:\/\/[a-z]{2}\.wikipedia\.org\//i.test(url);
  },

  async convert(url: string, signal?: AbortSignal): Promise<string> {
    const parsed = parseWikiUrl(url);
    if (!parsed) throw new Error(`Unable to parse Wikipedia URL: ${url}`);
    return convertWikiPath(parsed, signal);
  },
};
