import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { SearchResult, JsonpDataItem } from "./types";

function stripHtml(text: string): string {
  const $ = cheerio.load(`<div>${text}</div>`);
  return $("div").text();
}

export function singleLine(text: string): string {
  return stripHtml(text).replace(/\s+/g, " ").trim();
}

export function extractPreloadUrl(html: string): string {
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

export function parseJsonpData(
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

function extractResultFromElement(
  $: cheerio.CheerioAPI,
  el: AnyNode,
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

export function parseSearchResults(
  $: cheerio.CheerioAPI,
  items: cheerio.Cheerio<AnyNode>,
  results: SearchResult[],
  maxResults: number,
): void {
  items.each((_, el) => {
    if (results.length >= maxResults) return false;
    const result = extractResultFromElement($, el);
    if (result) results.push(result);
  });
}
