import { formatDate } from "../../../../../shared/format/time-formatting";
import { formatNumber } from "../../../../../shared/format/text-formatting";
import { HN_BASE } from "../constants";
import { fetchAlgoliaSearch } from "../http";

function renderSearchHit(rank: number, hit: Record<string, unknown>): string[] {
  const id = Number(hit.objectID);
  const fields = extractSearchFields(hit);
  const lines: string[] = [`**${rank}. ${fields.title}**`];
  lines.push(buildSearchMeta(fields));
  lines.push(renderSearchLinks(id, fields.url));

  return lines;
}

function extractSearchFields(hit: Record<string, unknown>): {
  title: string;
  url: string | null;
  points: number;
  numComments: number;
  author: string;
  createdAt: string | null;
} {
  return {
    title: safeString(hit.title) || "(no title)",
    url: safeString(hit.url),
    points: Number(hit.points || 0),
    numComments: Number(hit.num_comments || 0),
    author: safeString(hit.author) || "",
    createdAt: safeString(hit.created_at),
  };
}

function safeString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function buildSearchMeta(fields: {
  points: number;
  numComments: number;
  author: string;
  createdAt: string | null;
}): string {
  const meta: string[] = [
    `score: ${formatNumber(fields.points)}`,
    `comments: ${formatNumber(fields.numComments)}`,
  ];
  if (fields.author) meta.push(`by: ${fields.author}`);
  if (fields.createdAt) {
    meta.push(formatDate(fields.createdAt));
  }
  return meta.join(" \u2022 ");
}

function renderSearchLinks(id: number, url: string | null): string {
  const links: string[] = [`[HN](${HN_BASE}/item?id=${id})`];
  if (url) links.push(`[${url}](${url})`);
  return links.map((l) => `    ${l}`).join(" ");
}

async function handleSearch(
  query: string,
  limit: number,
  signal?: AbortSignal,
): Promise<string> {
  const hits = await fetchAlgoliaSearch(query, limit, signal);
  const parts: string[] = [`# Hacker News Search — "${query}"`, ""];

  for (let i = 0; i < hits.length; i++) {
    if (i > 0) parts.push("");
    parts.push(...renderSearchHit(i + 1, hits[i] as Record<string, unknown>));
  }

  return parts.join("\n");
}

export { handleSearch };
