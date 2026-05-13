import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { Static } from "typebox";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { textResult } from "../../shared/result/tool-result";
import { dotJoin, countLabel } from "../../shared/rendering/header";
import { table } from "../../shared/rendering/table/renderer";
import type { Column } from "../../shared/rendering/types";
import { acquireSlot } from "../../shared/network/throttle";
const DDG_HOST = "duckduckgo.com";
const MAX_REDIRECTS = 3;

function handleRedirect(response: Response, currentUrl: string): string | null {
  if (response.status < 300 || response.status >= 400) return null;
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location, currentUrl).toString();
}

async function fetchWithRedirect(
  url: string,
  init: RequestInit = {},
): Promise<{
  response: Response;
  redirected: boolean;
  redirectChain: string[];
}> {
  const redirectChain: string[] = [];
  let currentUrl = url;
  let redirected = false;

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    const response = await fetch(currentUrl, init);

    const nextUrl = handleRedirect(response, currentUrl);
    if (nextUrl) {
      redirectChain.push(currentUrl);
      currentUrl = nextUrl;
      redirected = true;
      init.headers = response.headers;
      continue;
    }

    return { response, redirected, redirectChain };
  }

  throw new Error(
    `DuckDuckGo request redirected too many times (${MAX_REDIRECTS})`,
  );
}

const DDG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  Connection: "keep-alive",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-ch-ua":
    '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "upgrade-insecure-requests": "1",
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "navigate",
  "sec-fetch-user": "?1",
  "sec-fetch-dest": "document",
  referer: "https://duckduckgo.com/",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};
const DDG_DATA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36",
  Connection: "keep-alive",
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-ch-ua":
    '"Chromium";v="112", "Google Chrome";v="112", "Not:A-Brand";v="99"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-site": "same-site",
  "sec-fetch-mode": "no-cors",
  "sec-fetch-dest": "script",
  referer: "https://duckduckgo.com/",
  "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
};
interface SearchResult {
  title: string;
  url: string;
  description: string;
  source: string;
  engine: string;
}
interface JsonpDataItem {
  n?: boolean;
  t?: string;
  u?: string;
  a?: string;
  i?: string;
  sn?: string;
}
function stripHtml(text: string): string {
  const $ = cheerio.load(`<div>${text}</div>`);
  return $("div").text();
}
function singleLine(text: string): string {
  return stripHtml(text).replace(/\s+/g, " ").trim();
}
const searchCols: Column[] = [
  { key: "#", align: "right", minWidth: 3 },
  {
    key: "title",
    format(_v, row) {
      const r = row as { title: string; url: string; description: string };
      const lines = [r.title];
      if (r.description) lines.push(r.description);
      lines.push(r.url);
      return lines.join("\n");
    },
  },
];
function formatSearchOutput(query: string, results: SearchResult[]): string {
  const rows = results.map((r, i) => ({
    "#": String(i + 1),
    title: singleLine(r.title) || "(untitled)",
    url: r.url,
    description: singleLine(r.description),
  }));

  return [
    dotJoin(countLabel(results.length, "result")),
    "",
    table(searchCols, rows),
  ].join("\n");
}

const SearchDuckDuckGoParams = Type.Object({
  query: Type.String({ description: "Search query" }),
  limit: Type.Optional(
    Type.Number({ description: "Number of results (default 10)" }),
  ),
});
type SearchDuckDuckGoParamsType = Static<typeof SearchDuckDuckGoParams>;
function extractPreloadUrl(html: string): string {
  const $ = cheerio.load(html);
  let basePreloadUrl = "";

  $('link[rel="preload"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href?.includes("links.duckduckgo.com/d.js")) {
      basePreloadUrl = href;
      return false;
    }
  });

  if (!basePreloadUrl)
    $("#deep_preload_script").each((_, el) => {
      const src = $(el).attr("src");
      if (src?.includes("links.duckduckgo.com/d.js")) {
        basePreloadUrl = src;
        return false;
      }
    });

  if (!basePreloadUrl) {
    const urlRegex = /https:\/\/links\.duckduckgo\.com\/d\.js\?[^"']+\//i;
    const urlMatch = urlRegex.exec(html);
    if (urlMatch) basePreloadUrl = urlMatch[0];
  }

  return basePreloadUrl;
}
function parseJsonpData(
  dataHtml: string,
  maxResults: number,
): { results: SearchResult[]; validCount: number } {
  const raw = extractJsonpData(dataHtml);
  if (!raw) return { results: [], validCount: 0 };

  try {
    const jsonData = JSON.parse(raw) as JsonpDataItem[];
    return buildSearchResults(jsonData, maxResults);
  } catch {
    return { results: [], validCount: 0 };
  }
}
function extractJsonpData(dataHtml: string): string | null {
  const jsonpRegex = /DDG\.pageLayout\.load\('d',\s*(\[.*?\])\s*\);/s;
  const match = jsonpRegex.exec(dataHtml);
  return match?.[1] ?? null;
}
function buildSearchResults(
  items: JsonpDataItem[],
  maxResults: number,
): { results: SearchResult[]; validCount: number } {
  const results: SearchResult[] = [];
  let validCount = 0;

  for (const item of items) {
    if (shouldSkipItem(item, results.length, maxResults)) continue;
    validCount++;
    results.push(toSearchResult(item));
  }

  return { results, validCount };
}
function shouldSkipItem(
  item: JsonpDataItem,
  currentLength: number,
  maxResults: number,
): boolean {
  return !!item.n || currentLength >= maxResults;
}
function toSearchResult(item: JsonpDataItem): SearchResult {
  const { t: title = "", u: url = "", a: description = "", i, sn } = item;
  return {
    title,
    url,
    description,
    source: i ?? sn ?? "",
    engine: "duckduckgo",
  };
}

async function fetchPreloadPage(
  preloadUrl: URL,
  offset: number,
  maxResults: number,
): Promise<{
  results: SearchResult[];
  validCount: number;
  hasMore: boolean;
}> {
  preloadUrl.searchParams.set("s", offset.toString());

  await acquireSlot(DDG_HOST);
  const { response } = await fetchWithRedirect(preloadUrl.toString(), {
    headers: DDG_DATA_HEADERS,
  });

  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const dataHtml = await response.text();
  const { results, validCount } = parseJsonpData(dataHtml, maxResults);

  return {
    results,
    validCount,
    hasMore: validCount > 0,
  };
}

async function fetchInitialSearchPage(query: string): Promise<URL | null> {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&ia=web`;
  await acquireSlot(DDG_HOST);
  const { response } = await fetchWithRedirect(searchUrl, {
    headers: DDG_HEADERS,
  });

  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const html = await response.text();
  const basePreloadUrl = extractPreloadUrl(html);

  if (!basePreloadUrl) return null;
  return new URL(basePreloadUrl);
}

async function collectPreloadPages(
  preloadUrl: URL,
  maxResults: number,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  let offset = 0;

  while (results.length < maxResults) {
    const {
      results: pageResults,
      validCount,
      hasMore,
    } = await fetchPreloadPage(preloadUrl, offset, maxResults - results.length);

    results.push(...pageResults);

    if (!hasMore || validCount === 0) break;
    offset += validCount;
  }

  return results.slice(0, maxResults);
}

async function searchDuckDuckGoPreloadUrl(
  query: string,
  maxResults = 10,
): Promise<SearchResult[]> {
  const preloadUrl = await fetchInitialSearchPage(query);
  if (!preloadUrl) return [];

  return collectPreloadPages(preloadUrl, maxResults);
}
function extractResultFromElement(
  $: cheerio.CheerioAPI,
  el: Element,
): SearchResult | null {
  if ($(el).hasClass("result--ad")) return null;

  const titleEl = $(el).find("a.result__a");
  const title = titleEl.text().trim();
  const url = titleEl.attr("href");
  if (!title || !url) return null;

  const description = $(el).find(".result__snippet").text().trim();
  const source = $(el).find(".result__url").text().trim();

  return {
    title,
    url,
    description,
    source,
    engine: "duckduckgo",
  };
}

function parseSearchResults(
  $: cheerio.CheerioAPI,
  items: cheerio.Cheerio<Element>,
  results: SearchResult[],
  maxResults: number,
): void {
  items.each((_, el) => {
    if (results.length >= maxResults) return false;
    const result = extractResultFromElement($, el);
    if (result) results.push(result);
  });
}

async function fetchHtmlPage(
  query: string,
  offset: number,
): Promise<{ html: string; ok: boolean }> {
  const requestUrl = "https://html.duckduckgo.com/html/";

  await acquireSlot(DDG_HOST);
  const bodyParams = new URLSearchParams(
    offset === 0
      ? { q: query }
      : {
          q: query,
          s: offset.toString(),
          dc: offset.toString(),
          v: "l",
          o: "json",
          api: "d.js",
        },
  );
  const { response } = await fetchWithRedirect(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Apifox/1.0.0 (https://apifox.com)",
      Accept: "*/*",
      Host: "html.duckduckgo.com",
      Connection: "keep-alive",
    },
    body: bodyParams.toString(),
  });

  return { html: await response.text(), ok: response.ok };
}

async function paginateHtmlResults(
  query: string,
  results: SearchResult[],
  maxResults: number,
  startOffset: number,
): Promise<void> {
  let offset = startOffset;
  let items = cheerio.load("")("div.result");

  while (results.length < maxResults && items.length > 0) {
    const nextPage = await fetchHtmlPage(query, offset);
    if (!nextPage.ok) break;

    const next$ = cheerio.load(nextPage.html);
    const nextItems = next$("div.result");
    parseSearchResults(next$, nextItems, results, maxResults);
    offset += nextItems.length;
    items = nextItems;
  }
}

async function collectHtmlPages(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const firstResult = await fetchHtmlPage(query, 0);
  if (!firstResult.ok) throw new Error(`HTTP fetch failed`);

  const $ = cheerio.load(firstResult.html);
  const items = $("div.result");
  if (items.length === 0) return results;

  parseSearchResults($, items, results, maxResults);
  await paginateHtmlResults(query, results, maxResults, items.length);

  return results.slice(0, maxResults);
}

async function searchDuckDuckGoHtml(
  query: string,
  maxResults = 10,
): Promise<SearchResult[]> {
  await acquireSlot(DDG_HOST);
  return collectHtmlPages(query, maxResults);
}

function formatSearchError(error: unknown): Error {
  const status = (error as { status?: number })?.status;
  return new Error(
    status
      ? `DuckDuckGo search failed (HTTP ${status})`
      : "DuckDuckGo search failed",
    { cause: error },
  );
}

async function searchDuckDuckGo(
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  try {
    const results = await searchDuckDuckGoPreloadUrl(query, limit);
    if (results.length > 0) return results;
  } catch {}

  try {
    return await searchDuckDuckGoHtml(query, limit);
  } catch (error) {
    throw formatSearchError(error);
  }
}
export default function duckduckgoExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "search-web",
    label: "Search DuckDuckGo",
    description: `Search using DuckDuckGo search engine.

Use this to:
- Find web pages and articles
- Discover content on the internet
- Get search results with metadata

Returns search results with titles, URLs, and descriptions.`,
    parameters: SearchDuckDuckGoParams,

    async execute(_toolCallId: string, params: SearchDuckDuckGoParamsType) {
      try {
        const { query, limit = 10 } = params;
        const results = await searchDuckDuckGo(query, limit);

        if (results.length === 0)
          return textResult("No results found.", { query, limit });
        const text = formatSearchOutput(query, results);
        return textResult(text, { query, limit, results });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return textResult(`Error: ${message}`, { query: params.query });
      }
    },
  });
}
