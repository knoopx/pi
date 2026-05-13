import { createRetryFetchText } from "../../lib/parser-utils";

const wikiFetchText = createRetryFetchText({ apiName: "Wikipedia" });

interface SearchResult {
  title: string;
  snippet?: string;
  size?: number;
  timestamp?: number;
  pageid?: number;
}

export async function handleSearch(
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
