import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";
import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { textResult } from "../../shared/tool-utils";
import { dotJoin, countLabel, table } from "../../shared/renderers";
import type { Column } from "../../shared/renderers";
import { acquireSlot } from "../../shared/throttle";

const DDG_HOST = "duckduckgo.com";
const MAX_REDIRECTS = 3;

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

    if (!response.ok && response.status < 300)
      return { response, redirected, redirectChain };

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, redirected, redirectChain };
      const nextUrl = new URL(location, currentUrl).toString();
      redirectChain.push(currentUrl);
      currentUrl = nextUrl;
      redirected = true;
      // Preserve headers and body across redirects
      init.headers = response.headers;
      continue;
    }

    return { response, redirected, redirectChain };
  }

  throw new Error(
    `DuckDuckGo request redirected too many times (${MAX_REDIRECTS})`,
  );
}

// Standard headers for DuckDuckGo requests
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

// Parameter schema
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

  // Method 1: Use cheerio to find preload links
  $('link[rel="preload"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href?.includes("links.duckduckgo.com/d.js")) {
      basePreloadUrl = href;
      return false;
    }
  });

  // Method 2: If preload link not found, try script tag
  if (!basePreloadUrl)
    $("#deep_preload_script").each((_, el) => {
      const src = $(el).attr("src");
      if (src?.includes("links.duckduckgo.com/d.js")) {
        basePreloadUrl = src;
        return false;
      }
    });

  // Method 3: Use regex to extract from entire HTML
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
  return {
    title: item.t || "",
    url: item.u || "",
    description: item.a || "",
    source: item.i || item.sn || "",
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

async function searchDuckDuckGoPreloadUrl(
  query: string,
  maxResults = 10,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&ia=web`;
  await acquireSlot(DDG_HOST);
  const { response } = await fetchWithRedirect(searchUrl, {
    headers: DDG_HEADERS,
  });

  if (!response.ok)
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  const html = await response.text();
  const basePreloadUrl = extractPreloadUrl(html);

  if (!basePreloadUrl) return [];

  const preloadUrlObj = new URL(basePreloadUrl);
  let offset = 0;

  while (results.length < maxResults) {
    const {
      results: pageResults,
      validCount,
      hasMore,
    } = await fetchPreloadPage(
      preloadUrlObj,
      offset,
      maxResults - results.length,
    );

    results.push(...pageResults);

    if (!hasMore || validCount === 0) break;
    offset += validCount;
  }

  return results.slice(0, maxResults);
}

function parseSearchResults(
  $: cheerio.CheerioAPI,
  items: cheerio.Cheerio<Element>,
  results: SearchResult[],
  maxResults: number,
): void {
  items.each((_, el) => {
    if (results.length >= maxResults) return false;

    const titleEl = $(el).find("a.result__a");
    const snippetEl = $(el).find(".result__snippet");
    const title = titleEl.text().trim();
    const url = titleEl.attr("href") || "";
    const description = snippetEl.text().trim();
    const sourceEl = $(el).find(".result__url");
    const source = sourceEl.text().trim();

    if (title && url && !$(el).hasClass("result--ad"))
      results.push({
        title,
        url,
        description,
        source,
        engine: "duckduckgo",
      });
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

async function searchDuckDuckGoHtml(
  query: string,
  maxResults = 10,
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  let offset = 0;

  await acquireSlot(DDG_HOST);
  const { html, ok } = await fetchHtmlPage(query, 0);

  if (!ok) throw new Error(`HTTP fetch failed`);

  let $ = cheerio.load(html);
  let items = $("div.result");

  if (items.length === 0) return results;

  parseSearchResults($, items, results, maxResults);

  while (results.length < maxResults && items.length > 0) {
    offset += items.length;
    const { html: nextHtml, ok: nextOk } = await fetchHtmlPage(query, offset);

    if (!nextOk) break;

    $ = cheerio.load(nextHtml);
    items = $("div.result");
    parseSearchResults($, items, results, maxResults);
  }

  return results.slice(0, maxResults);
}

/**
 * Search DuckDuckGo and return results
 * @param query Search query
 * @param limit Maximum number of results
 * @returns Array of search results
 */
async function searchDuckDuckGo(
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  // Try using the preloaded URL method
  try {
    const results = await searchDuckDuckGoPreloadUrl(query, limit);
    if (results.length > 0) return results;
  } catch {
    // fall through to HTML method
  }

  try {
    return await searchDuckDuckGoHtml(query, limit);
  } catch (error) {
    const status = (error as { status?: number })?.status;
    throw new Error(
      status
        ? `DuckDuckGo search failed (HTTP ${status})`
        : "DuckDuckGo search failed",
      { cause: error },
    );
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
