type WikiPathType = "article" | "search";

export interface WikiPath {
  type: WikiPathType;
  title?: string;
  query?: string;
  lang: string;
  limit?: number;
}

function resolveSearchQuery(
  searchParams: URLSearchParams,
  searchKey: string,
): string {
  return searchParams.get(searchKey) ?? searchParams.get("title") ?? "";
}

function parseSearchLimit(searchParams: URLSearchParams): number {
  const limit = parseInt(searchParams.get("limit") ?? "10", 10);
  return isNaN(limit) ? 10 : limit;
}

function buildSearchResult(
  searchParams: URLSearchParams,
  lang: string,
  searchKey: string = "search",
): WikiPath | null {
  const search = resolveSearchQuery(searchParams, searchKey);
  if (!search || searchParams.get("action")) return null;
  return {
    type: "search",
    query: decodeURIComponent(search),
    lang,
    limit: parseSearchLimit(searchParams),
  };
}

function parseWikiPath(rest: string, lang: string): WikiPath | null {
  const articleResult = tryParseArticlePath(rest, lang);
  if (articleResult) return articleResult;
  return tryParseWikiSearch(rest, lang) ?? null;
}

export function parseWikiUrl(url: string): WikiPath | null {
  const match = url.match(/^https?:\/\/([a-z]{2})\.wikipedia\.org\/(.+)$/i);
  if (!match) return null;
  const lang = match[1].toLowerCase();
  const rest = match[2].replace(/\/+$/, "");
  if (!rest) return null;
  return parseWikiPath(rest, lang);
}

function tryParseArticlePath(rest: string, lang: string): WikiPath | null {
  const match = rest.match(/^wiki\/(.+)$/);
  if (!match) return null;
  // Don't match paths with query strings (those are search URLs)
  if (match[1].includes("?")) return null;
  return {
    type: "article",
    title: decodeURIComponent(match[1].replace(/_/g, " ")),
    lang,
  };
}

const SEARCH_PREFIXES = [
  "w/index.php/",
  "wiki/Special:Search/",
  "w/index.php?",
  "wiki/Special:Search?",
];

function tryParseWikiSearch(rest: string, lang: string): WikiPath | null {
  const prefix = SEARCH_PREFIXES.find((p) => rest.startsWith(p));
  if (!prefix) return null;
  const searchParams = new URLSearchParams(rest.slice(prefix.length));
  return buildSearchResult(searchParams, lang);
}
