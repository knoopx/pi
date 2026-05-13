type WikiPathType = "article" | "search";

export interface WikiPath {
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

export function parseWikiUrl(url: string): WikiPath | null {
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
