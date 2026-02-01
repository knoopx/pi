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
  query: Type.Optional(Type.String({
    description: "Search query for bookmark title (returns all bookmarks if not provided)",
  })),
  limit: Type.Optional(Type.Number({
    minimum: 1,
    maximum: 1000,
    description: "Maximum number of bookmarks to return (default: 50)",
  })),
});

type SearchBookmarksParamsType = Static<typeof SearchBookmarksParams>;

// Parameter schemas for history tools
export const SearchHistoryParams = Type.Object({
  query: Type.Optional(Type.String({
    description: "Search query for history title or URL (returns all history if not provided)",
  })),
  limit: Type.Optional(Type.Number({
    minimum: 1,
    maximum: 1000,
    description: "Maximum number of history entries to return (default: 50)",
  })),
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

export function getFirefoxProfilePath(_profileName?: string): string {
  const home = process.env.HOME || "/home/user";
  // Default profile path based on profiles.ini
  return `${home}/.mozilla/firefox/knoopx/places.sqlite`;
}

export async function getBookmarksFromDB(query?: string): Promise<Bookmark[]> {
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
    // Copy the database file
    await fs.copyFile(placesPath, tempDbPath);

    const sqlite3 = await import("better-sqlite3");
    const db: Database = sqlite3.default(tempDbPath);
    db.pragma("journal_mode = WAL");

    try {
      const bookmarks: Bookmark[] = [];

      // Get all bookmarks first (deduplicated in SQL)
      const rows = db
        .prepare(
          `
          SELECT b.id, p.url, b.title, MAX(b.dateAdded) as dateAdded
          FROM moz_bookmarks b
          JOIN moz_places p ON b.fk = p.id
          WHERE p.url LIKE 'http%' OR p.url LIKE 'https%'
          GROUP BY p.url
          ORDER BY dateAdded DESC
          LIMIT 1000
        `,
        )
        .all() as BookmarkRowWithUrl[];

      const allBookmarks = rows.map((row: BookmarkRowWithUrl) => ({
        id: String(row.id),
        title: row.title || new URL(row.url).hostname,
        url: row.url,
        domain: extractDomain(row.url),
        dateAdded: row.dateAdded || Date.now(),
      }));

      if (query) {
        // Similarity search
        const scoredBookmarks = allBookmarks.map((bookmark) => {
          const similarity = similarityScore(
            bookmark.title.toLowerCase(),
            query.toLowerCase(),
          );
          return {
            ...bookmark,
            similarity,
          };
        });

        const matchingBookmarks = scoredBookmarks
          .filter((b) => b.similarity >= 0.6)
          .sort((a, b) => b.dateAdded - a.dateAdded);

        bookmarks.push(...matchingBookmarks);
      } else {
        // List all bookmarks (already sorted by dateAdded DESC)
        bookmarks.push(...allBookmarks);
      }

      // Close database connection
      db.close();

      return bookmarks;
    } catch (dbError) {
      db.close();
      throw dbError;
    } finally {
      // Clean up the temporary database file
      try {
        await fs.unlink(tempDbPath);
      } catch (_cleanupError) {
        // Ignore cleanup errors - the temp file will be cleaned up eventually
        console.error("Failed to cleanup temp database:", _cleanupError);
      }
    }
  } catch (dbError) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempDbPath).catch(() => {});
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }
    throw dbError;
  }
}

export async function getHistoryFromDB(query?: string): Promise<History[]> {
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
    // Copy the database file
    await fs.copyFile(placesPath, tempDbPath);

    const sqlite3 = await import("better-sqlite3");
    const db: Database = sqlite3.default(tempDbPath);
    db.pragma("journal_mode = WAL");

    try {
      const history: History[] = [];

      // Get all history entries (deduplicated in SQL)
      const rows = db
        .prepare(
          `
          SELECT p.id, p.url, p.title, p.visit_count, MAX(p.last_visit_date) as last_visit_date
          FROM moz_places p
          WHERE (p.url LIKE 'http%' OR p.url LIKE 'https%')
            AND p.visit_count > 0
            AND p.last_visit_date > 0
          GROUP BY p.url
          ORDER BY last_visit_date DESC
          LIMIT 1000
        `,
        )
        .all() as HistoryRowWithUrl[];

      const allHistory = rows.map((row: HistoryRowWithUrl) => ({
        id: String(row.id),
        title: row.title || new URL(row.url).hostname,
        url: row.url,
        domain: extractDomain(row.url),
        visitCount: row.visitCount || 0,
        lastVisit: row.lastVisit || 0,
      }));

      if (query) {
        // Similarity search on title and URL
        const scoredHistory = allHistory.map((entry) => {
          const titleSimilarity = similarityScore(
            entry.title.toLowerCase(),
            query.toLowerCase(),
          );
          const urlSimilarity = similarityScore(
            entry.url.toLowerCase(),
            query.toLowerCase(),
          );
          const similarity = Math.max(titleSimilarity, urlSimilarity);
          return {
            ...entry,
            similarity,
          };
        });

        const matchingHistory = scoredHistory
          .filter((h) => h.similarity >= 0.6)
          .sort((a, b) => b.lastVisit - a.lastVisit);

        history.push(...matchingHistory);
      } else {
        // List all history (already sorted by lastVisit DESC)
        history.push(...allHistory);
      }

      // Close database connection
      db.close();

      return history;
    } catch (dbError) {
      db.close();
      throw dbError;
    } finally {
      // Clean up the temporary database file
      try {
        await fs.unlink(tempDbPath);
      } catch (_cleanupError) {
        // Ignore cleanup errors - the temp file will be cleaned up eventually
        console.error("Failed to cleanup temp database:", _cleanupError);
      }
    }
  } catch (dbError) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempDbPath).catch(() => {});
    } catch (_cleanupError) {
      // Ignore cleanup errors
    }
    throw dbError;
  }
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
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ): Promise<AgentToolResult<unknown>> {
      try {
        const { query = "", limit = 50 } = params;

        // Build bookmarks list from database
        try {
          const bookmarks = await getBookmarksFromDB(query);

          // Format date as YYYY-MM-DD
          const formatDate = (timestamp: number): string => {
            const date = new Date(timestamp / 1000); // Firefox uses microseconds
            return date.toISOString().split("T")[0];
          };

          // Build content
          const content = bookmarks
            .slice(0, limit) // Use the limit parameter
            .map((bookmark) => {
              const dateStr = formatDate(bookmark.dateAdded);
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
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ): Promise<AgentToolResult<unknown>> {
      try {
        const { query = "", limit = 50 } = params;

        try {
          const history = await getHistoryFromDB(query);

          // Format date as YYYY-MM-DD
          const formatDate = (timestamp: number): string => {
            const date = new Date(timestamp / 1000); // Firefox uses microseconds
            return date.toISOString().split("T")[0];
          };

          // Build content
          const content = history
            .slice(0, limit)
            .map((entry) => {
              const dateStr = formatDate(entry.lastVisit);
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
