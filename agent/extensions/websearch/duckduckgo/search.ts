import * as cheerio from "cheerio";
import { acquireSlot } from "../../../shared/network/throttle";
import type { SearchResult } from "./types";
import { DDG_HOST, DDG_HEADERS, DDG_DATA_HEADERS } from "./constants";
import { fetchWithRedirect } from "./http";
import {
  extractPreloadUrl,
  parseJsonpData,
  parseSearchResults,
} from "./parsing";

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

export async function searchDuckDuckGo(
  query: string,
  limit: number,
): Promise<SearchResult[]> {
  try {
    const results = await searchDuckDuckGoPreloadUrl(query, limit);
    if (results.length > 0) return results;
  } catch {
    // Graceful degradation: preload URL failed, falling back to direct search
  }

  try {
    return await searchDuckDuckGoHtml(query, limit);
  } catch (error) {
    throw formatSearchError(error);
  }
}
