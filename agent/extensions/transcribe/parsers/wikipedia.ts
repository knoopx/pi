import type { Parser } from "../lib/types";
import { BROWSER_HEADERS } from "../lib/constants";
import { retry } from "../lib/retry";

const FETCH_OPTIONS: Parameters<typeof retry>[1] = {
  maxRetries: 2,
  retryDelay: 500,
};

const EXTRACT_MAX_LEN = 300;
const SNIPPET_MAX_LEN = 120;

// --- URL parsing ---

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

  // /wiki/Article_Title — article page
  const articleResult = tryParseArticlePath(rest, lang);
  if (articleResult) return articleResult;

  // /w/index.php?search=... or special search URLs
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

// --- API fetch ---

async function wikiFetch(
  lang: string,
  path: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const url = `https://${lang}.wikipedia.org${path}`;
  return retry(async () => {
    const resp = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal,
    });
    if (!resp.ok) {
      throw new Error(`Wikipedia API HTTP ${resp.status}: ${resp.statusText}`);
    }
    return resp.json();
  }, FETCH_OPTIONS);
}

// --- Handlers ---

interface SummaryData {
  title: string;
  description?: string;
  extract?: string;
  content_urls?: {
    desktop?: { page?: string };
  };
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}

async function handleArticle(
  title: string,
  lang: string,
  signal?: AbortSignal,
): Promise<string> {
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));
  const data = (await wikiFetch(
    lang,
    `/api/rest_v1/page/summary/${encoded}`,
    signal,
  )) as SummaryData;

  if (!data?.title) return renderArticleNotFound(title, lang);

  const parts: string[] = [`# ${data.title}`, ""];
  parts.push(...renderArticleDescription(data));
  parts.push(...renderArticleExtract(data));
  parts.push(renderArticleLink(data, lang, encoded));

  return parts.join("\n");
}

function renderArticleNotFound(title: string, lang: string): string {
  return `# Article Not Found\n\nCould not find an article titled "${title}" on ${lang}.wikipedia.org.\n\nTry searching instead.`;
}

function renderArticleDescription(data: SummaryData): string[] {
  if (!data.description) return [];
  return [`> ${data.description}`, ""];
}

function renderArticleExtract(data: SummaryData): string[] {
  if (!data.extract) return [];
  const extract =
    data.extract.length > EXTRACT_MAX_LEN
      ? data.extract.slice(0, EXTRACT_MAX_LEN) + "..."
      : data.extract;
  return [extract, ""];
}

function renderArticleLink(
  data: SummaryData,
  lang: string,
  encoded: string,
): string {
  const pageUrl =
    data.content_urls?.desktop?.page ??
    `https://${lang}.wikipedia.org/wiki/${encoded}`;
  return `[Read full article on Wikipedia](${pageUrl})`;
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
  const data = (await wikiFetch(
    lang,
    `/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=${clamped}&format=json&utf8=1`,
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
    const snippet = r.snippet.replace(/<[^>]+>/g, "");
    lines.push(
      snippet.length > SNIPPET_MAX_LEN
        ? snippet.slice(0, SNIPPET_MAX_LEN) + "..."
        : snippet,
    );
  }

  return lines;
}

// --- Parser export ---

export const parser: Parser = {
  matches(url: string): boolean {
    return /^https?:\/\/[a-z]{2}\.wikipedia\.org\//i.test(url);
  },

  async convert(url: string, signal?: AbortSignal): Promise<string> {
    const parsed = parseWikiUrl(url);
    if (!parsed) throw new Error(`Unable to parse Wikipedia URL: ${url}`);

    switch (parsed.type) {
      case "article":
        return handleArticle(parsed.title!, parsed.lang, signal);
      case "search":
        return handleSearch(
          parsed.query ?? "",
          parsed.lang,
          parsed.limit ?? 10,
          signal,
        );
    }
  },
};
