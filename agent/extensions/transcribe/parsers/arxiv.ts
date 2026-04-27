import { defineParser } from "../lib/parser-utils.js";
import { retry } from "../lib/retry";

const API_BASE = "https://export.arxiv.org/api/query";

const FETCH_OPTIONS: Parameters<typeof retry>[1] = {
  maxRetries: 2,
  retryDelay: 500,
};

interface ArxivEntry {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  published: string;
  url: string;
  categories?: string[];
  comments?: string;
}

// --- URL parsing ---

type ArxivPathType = "paper" | "search" | "list";

interface ArxivPath {
  type: ArxivPathType;
  id?: string;
  query?: string;
  category?: string;
  limit?: number;
}

function parseArxivUrl(url: string): ArxivPath | null {
  const match = url.match(/^https?:\/\/arxiv\.org\/(.+)$/);
  if (!match) return null;

  const rest = match[1].replace(/\/+$/, "");
  if (!rest) return null;

  // /abs/<id> or /pdf/<id> — paper detail
  const paperResult = tryParsePaperPath(rest);
  if (paperResult) return paperResult;

  // /search/?searchquery=<q>&...
  const searchResult = tryParseSearchPath(rest);
  if (searchResult) return searchResult;

  // /list/<category>/<count>
  const listResult = tryParseListPath(rest);
  if (listResult) return listResult;

  return null;
}

function tryParsePaperPath(rest: string): ArxivPath | null {
  // /abs/<id>, /pdf/<id>, or /html/<id>
  const match = rest.match(/^(?:abs|pdf|html)\/([^/]+)$/);
  if (match) return { type: "paper", id: match[1].replace(/\.pdf$/, "") };
  return null;
}

function tryParseSearchPath(rest: string): ArxivPath | null {
  if (!rest.startsWith("search/")) return null;
  const searchParams = new URLSearchParams(rest.replace(/^search\/?/, ""));
  const query = searchParams.get("searchquery") ?? "";
  const start = parseInt(searchParams.get("start") ?? "0", 10);
  return { type: "search", query, limit: Math.min(start + 30, 30) };
}

function tryParseListPath(rest: string): ArxivPath | null {
  const match = rest.match(/^list\/([^/]+)(?:\/(\d+))?$/);
  if (!match) return null;
  return {
    type: "list",
    category: match[1],
    limit: match[2] ? Math.min(parseInt(match[2], 10), 30) : 30,
  };
}

// --- XML parsing helpers ---

function extract(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function parseEntries(xml: string): ArxivEntry[] {
  const entryRe = /<entry>([\s\S]*?)<\/entry>/gi;
  const entries: ArxivEntry[] = [];
  let m;

  while ((m = entryRe.exec(xml)) !== null) {
    entries.push(parseSingleEntry(m[1]));
  }
  return entries;
}

function parseSingleEntry(e: string): ArxivEntry {
  const rawId = extract(e, "id");
  const arxivId = rawId
    .replace(/^https?:\/\/arxiv\.org\/abs\//, "")
    .replace(/v\d+$/, "");

  const summary = extract(e, "summary").replace(/\s+/g, " ");
  const commentTag = extract(e, "arxiv:comment");

  // Extract categories from primary_category and arxiv:subject_category tags
  const primary = rawId.match(/primary_category.+term="([^"]+)"/)?.[1] ?? null;
  const secondary: string[] = [];
  for (const cat of extractAll(e, "arxiv:subject_category")) {
    const term = cat.match(/term="([^"]+)"/);
    if (term) secondary.push(term[1]);
  }
  const categories = mergeCategories(primary, secondary);

  return {
    id: arxivId,
    title: extract(e, "title").replace(/\s+/g, " "),
    authors: extractAll(e, "name").join(", "),
    abstract: summary.length > 2000 ? summary.slice(0, 2000) + "..." : summary,
    published: extract(e, "published").slice(0, 10),
    url: `https://arxiv.org/abs/${arxivId}`,
    categories: categories.length ? categories : undefined,
    comments: commentTag || undefined,
  };
}

function mergeCategories(
  primary: string | null,
  secondary: string[],
): string[] {
  const categories: string[] = primary ? [primary] : [];
  for (const cat of secondary) {
    if (!categories.includes(cat)) categories.push(cat);
  }
  return categories;
}

// --- API fetch ---

async function arxivFetch(
  params: string,
  signal?: AbortSignal,
): Promise<string> {
  return retry(async () => {
    const url = `${API_BASE}?${params}`;
    const resp = await fetch(url, { signal });
    if (!resp.ok) {
      throw new Error(`arXiv API HTTP ${resp.status}: ${resp.statusText}`);
    }
    return resp.text();
  }, FETCH_OPTIONS);
}

// --- Handlers ---

async function fetchAndRender(
  params: string,
  emptyLabel: string,
  renderLabel: string,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  const clamped = Math.max(1, Math.min(limit, 30));
  const xml = await arxivFetch(`${params}&max_results=${clamped}`, signal);
  const entries = parseEntries(xml);
  if (!entries.length) {
    return `# ${emptyLabel}\n\nNo papers found.`;
  }
  return renderSearchResults(renderLabel, entries);
}

async function handlePaper(id: string, signal?: AbortSignal): Promise<string> {
  const xml = await arxivFetch(`id_list=${encodeURIComponent(id)}`, signal);
  const entries = parseEntries(xml);
  if (!entries.length) {
    throw new Error(
      `Paper ${id} not found. Check the arXiv ID format (e.g. 1706.03762).`,
    );
  }
  return renderEntry(entries[0]);
}

async function handleSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  return fetchAndRender(
    `search_query=all:${encodeURIComponent(query)}&sortBy=relevance`,
    `arXiv Search: "${query}"`,
    query,
    limit,
    signal,
  );
}

async function handleList(
  category: string,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  return fetchAndRender(
    `search_query=cat:${encodeURIComponent(category)}&sortBy=submittedDate`,
    `arXiv Category: ${category}`,
    `Category: ${category}`,
    limit,
    signal,
  );
}

// --- Rendering ---

function renderEntry(entry: ArxivEntry): string {
  const parts = [`# ${entry.title}`, ""];
  parts.push(renderEntryMeta(entry));
  parts.push(...renderEntryOptional(entry));
  parts.push("", entry.abstract);
  return parts.join("\n");
}

function renderEntryMeta(entry: ArxivEntry): string {
  return `**ID:** [${entry.id}](${entry.url})\n**Published:** ${entry.published}`;
}

function renderEntryOptional(entry: ArxivEntry): string[] {
  const parts: string[] = [];
  if (entry.authors) parts.push(`**Authors:** ${entry.authors}`);
  if (entry.categories?.length)
    parts.push(`**Categories:** ${entry.categories.join(", ")}`);
  if (entry.comments) parts.push("", `> ${entry.comments}`);
  return parts;
}

function renderSearchResults(label: string, entries: ArxivEntry[]): string {
  const parts = [`# arXiv — ${label}`, "", `${entries.length} result(s)`];

  for (const entry of entries) {
    parts.push("", ...renderSearchEntry(entry));
  }

  return parts.join("\n");
}

function renderSearchEntry(entry: ArxivEntry): string[] {
  const pageUrl = `https://arxiv.org/abs/${entry.id}`;
  const lines: string[] = [
    `## [${entry.title}](${pageUrl})`,
    "",
    `**ID:** \`${entry.id}\` **Published:** ${entry.published}`,
  ];

  if (entry.authors) lines.push(`**Authors:** ${entry.authors}`);
  if (entry.categories?.length)
    lines.push(`**Categories:** ${entry.categories.join(", ")}`);

  const preview = truncateText(entry.abstract, 400);
  lines.push("", preview);

  return lines;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

function dispatchArxiv(
  parsed: ArxivPath,
  signal?: AbortSignal,
): Promise<string> {
  const handlers: Record<ArxivPathType, () => Promise<string>> = {
    paper: () => handlePaper(parsed.id!, signal),
    search: () => handleSearch(parsed.query ?? "", parsed.limit ?? 10, signal),
    list: () => handleList(parsed.category ?? "", parsed.limit ?? 30, signal),
  };
  return handlers[parsed.type]();
}

export const parser = defineParser(
  "arXiv",
  (url) => /^https?:\/\/arxiv\.org\//i.test(url),
  parseArxivUrl,
  dispatchArxiv,
);
