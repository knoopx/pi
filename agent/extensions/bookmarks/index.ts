import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
  AgentToolResult,
} from "@mariozechner/pi-coding-agent";
import { URL } from "url";
import { Type, type Static } from "@sinclair/typebox";
import type { Database } from "better-sqlite3";

// Parameter schemas for bookmark tools
export const SearchBookmarksParams = Type.Object({
  query: Type.Optional(
    Type.String({
      description:
        "Search query for bookmark title (returns all bookmarks if not provided)",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 1000,
      description: "Maximum number of bookmarks to return (default: 50)",
    }),
  ),
});

type SearchBookmarksParamsType = Static<typeof SearchBookmarksParams>;

// Parameter schemas for history tools
export const SearchHistoryParams = Type.Object({
  query: Type.Optional(
    Type.String({
      description:
        "Search query for history title or URL (returns all history if not provided)",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 1000,
      description: "Maximum number of history entries to return (default: 50)",
    }),
  ),
});

type SearchHistoryParamsType = Static<typeof SearchHistoryParams>;

interface Bookmark {
  id: string;
  title: string;
  url: string;
  domain: string;
  dateAdded: number;
  folder?: string;
  similarity?: number;
}

interface History {
  id: string;
  title: string;
  url: string;
  domain: string;
  visitCount: number;
  lastVisit: number;
  similarity?: number;
}

interface BookmarkRowWithUrl {
  id: number;
  url: string;
  title: string | null;
  dateAdded: number;
}

interface HistoryRowWithUrl {
  id: number;
  url: string;
  title: string | null;
  visitCount: number;
  lastVisit: number;
}

/**
 * Calculate the Levenshtein distance between two strings.
 * This is the minimum number of single-character edits (insertions, deletions, or substitutions)
 * required to transform one string into the other.
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns The Levenshtein distance between the two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize the matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate the similarity score between two strings using Levenshtein distance.
 * Returns a value between 0 and 1, where 1 means perfect match.
 *
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score (0 = no similarity, 1 = identical)
 */
export function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
}

export function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return "";
  }
}

/**
 * Format Firefox timestamp (microseconds) as YYYY-MM-DD
 */
function formatFirefoxDate(timestamp: number): string {
  const date = new Date(timestamp / 1000); // Firefox uses microseconds
  return date.toISOString().split("T")[0];
}

export function getFirefoxProfilePath(_profileName?: string): string {
  const home = process.env.HOME || "/home/user";
  // Default profile path based on profiles.ini
  return `${home}/.mozilla/firefox/knoopx/places.sqlite`;
}

/**
 * Execute a query against the Firefox places database with proper temp file handling
 */
async function withFirefoxDb<TRow, TResult>(
  sql: string,
  rowMapper: (row: TRow) => TResult,
): Promise<TResult[]> {
  const placesPath = getFirefoxProfilePath();
  const fs = await import("fs/promises");

  // Check if database exists
  const dbExists = await fs
    .access(placesPath)
    .then(() => true)
    .catch(() => false);

  if (!dbExists) {
    throw new Error("Firefox database not found at expected location");
  }

  // Create a temporary copy of the database to avoid locking issues
  const tempDbPath = placesPath + ".tmp";

  try {
    await fs.copyFile(placesPath, tempDbPath);
    const sqlite3 = await import("better-sqlite3");
    const db: Database = sqlite3.default(tempDbPath);
    db.pragma("journal_mode = WAL");

    try {
      const rows = db.prepare(sql).all() as TRow[];
      db.close();
      return rows.map(rowMapper);
    } catch (dbError) {
      db.close();
      throw dbError;
    } finally {
      try {
        await fs.unlink(tempDbPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (dbError) {
    try {
      await fs.unlink(tempDbPath).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
    throw dbError;
  }
}

/**
 * Filter and sort items by similarity to a query
 */
function filterBySimilarity<T extends { similarity?: number }>(
  items: T[],
  query: string,
  getSimilarity: (item: T, query: string) => number,
  sortFn?: (a: T, b: T) => number,
): T[] {
  const scored = items.map((item) => ({
    ...item,
    similarity: getSimilarity(item, query),
  }));

  const filtered = scored.filter((item) => item.similarity >= 0.6);
  return sortFn ? filtered.sort(sortFn) : filtered;
}

export async function getBookmarksFromDB(query?: string): Promise<Bookmark[]> {
  const allBookmarks = await withFirefoxDb<BookmarkRowWithUrl, Bookmark>(
    `SELECT b.id, p.url, b.title, MAX(b.dateAdded) as dateAdded
     FROM moz_bookmarks b
     JOIN moz_places p ON b.fk = p.id
     WHERE p.url LIKE 'http%' OR p.url LIKE 'https%'
     GROUP BY p.url
     ORDER BY dateAdded DESC
     LIMIT 1000`,
    (row) => ({
      id: String(row.id),
      title: row.title || new URL(row.url).hostname,
      url: row.url,
      domain: extractDomain(row.url),
      dateAdded: row.dateAdded || Date.now(),
    }),
  );

  if (!query) return allBookmarks;

  return filterBySimilarity(
    allBookmarks,
    query,
    (bookmark, q) =>
      similarityScore(bookmark.title.toLowerCase(), q.toLowerCase()),
    (a, b) => (b.similarity ?? 0) - (a.similarity ?? 0),
  );
}

export async function getHistoryFromDB(query?: string): Promise<History[]> {
  const allHistory = await withFirefoxDb<HistoryRowWithUrl, History>(
    `SELECT p.id, p.url, p.title, p.visit_count as visitCount, MAX(p.last_visit_date) as lastVisit
     FROM moz_places p
     WHERE (p.url LIKE 'http%' OR p.url LIKE 'https%')
       AND p.visit_count > 0
       AND p.last_visit_date > 0
     GROUP BY p.url
     ORDER BY last_visit_date DESC
     LIMIT 1000`,
    (row) => ({
      id: String(row.id),
      title: row.title || new URL(row.url).hostname,
      url: row.url,
      domain: extractDomain(row.url),
      visitCount: row.visitCount || 0,
      lastVisit: row.lastVisit || 0,
    }),
  );

  if (!query) return allHistory;

  return filterBySimilarity(
    allHistory,
    query,
    (entry, q) => {
      const titleSim = similarityScore(
        entry.title.toLowerCase(),
        q.toLowerCase(),
      );
      const urlSim = similarityScore(entry.url.toLowerCase(), q.toLowerCase());
      return Math.max(titleSim, urlSim);
    },
    (a, b) => b.lastVisit - a.lastVisit,
  );
}

function createErrorResult(message: string): AgentToolResult<unknown> {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${message}`,
      },
    ],
    details: {},
  };
}

export default function (pi: ExtensionAPI) {
  // Search bookmarks
  pi.registerTool({
    name: "firefox-bookmarks",
    label: "Firefox Bookmarks",
    description: `Search Firefox bookmarks by title or URL.

Use this to:
- Find specific Firefox bookmarks
- Locate saved websites
- Filter bookmarks by content

Returns a list of matching bookmarks with details.`,
    parameters: SearchBookmarksParams,
    async execute(
      _toolCallId: string,
      params: SearchBookmarksParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ): Promise<AgentToolResult<unknown>> {
      try {
        const { query = "", limit = 50 } = params;

        // Build bookmarks list from database
        try {
          const bookmarks = await getBookmarksFromDB(query);

          // Build content
          const content = bookmarks
            .slice(0, limit) // Use the limit parameter
            .map((bookmark) => {
              const dateStr = formatFirefoxDate(bookmark.dateAdded);
              let line = `• ${bookmark.title} - ${bookmark.url}`;
              if (bookmark.domain) {
                line += ` (${bookmark.domain})`;
              }
              if (bookmark.similarity !== undefined) {
                line += ` [Similarity: ${(bookmark.similarity * 100).toFixed(1)}%]`;
              }
              line += ` [Added: ${dateStr}]`;
              return line;
            })
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `${content || "No bookmarks found"}\n\n${bookmarks.length} bookmark(s)${bookmarks.length > limit ? ` (showing first ${limit})` : ""}`,
              },
            ],
            details: {
              query,
              totalFound: bookmarks.length,
            },
          };
        } catch (dbError) {
          throw new Error(
            `Failed to query bookmarks database: ${(dbError as Error).message}`,
          );
        }
      } catch (error) {
        return createErrorResult((error as Error).message);
      }
    },
  });

  // Search history
  pi.registerTool({
    name: "firefox-history",
    label: "Firefox History",
    description: `Search Firefox browsing history by title or URL.

Use this to:
- Find recently visited websites
- Look up pages you've browsed
- Search your browsing history

Returns a list of matching history entries with details.`,
    parameters: SearchHistoryParams,
    async execute(
      _toolCallId: string,
      params: SearchHistoryParamsType,
      _signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ): Promise<AgentToolResult<unknown>> {
      try {
        const { query = "", limit = 50 } = params;

        try {
          const history = await getHistoryFromDB(query);

          // Build content
          const content = history
            .slice(0, limit)
            .map((entry) => {
              const dateStr = formatFirefoxDate(entry.lastVisit);
              let line = `• ${entry.title} - ${entry.url}`;
              if (entry.domain) {
                line += ` (${entry.domain})`;
              }
              if (entry.similarity !== undefined) {
                line += ` [Similarity: ${(entry.similarity * 100).toFixed(1)}%]`;
              }
              line += ` [Visited: ${dateStr}] [Count: ${entry.visitCount}]`;
              return line;
            })
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `${content || "No history found"}\n\n${history.length} history entr(y/ies)${history.length > limit ? ` (showing first ${limit})` : ""}`,
              },
            ],
            details: {
              query,
              totalFound: history.length,
            },
          };
        } catch (dbError) {
          throw new Error(
            `Failed to query history database: ${(dbError as Error).message}`,
          );
        }
      } catch (error) {
        return createErrorResult((error as Error).message);
      }
    },
  });
}
