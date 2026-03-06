import type {
  ExtensionAPI,
  AgentToolUpdateCallback,
  ExtensionContext,
  AgentToolResult,
} from "@mariozechner/pi-coding-agent";
import { URL } from "url";
import { Type, type Static } from "@sinclair/typebox";
import type { Database } from "better-sqlite3";
import { fuzzyFilter } from "../../shared/fuzzy";
import { dotJoin, countLabel, table } from "../renderers";
import type { Column } from "../renderers";

// Parameter schemas for bookmark tools
const SearchBookmarksParams = Type.Object({
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
const SearchHistoryParams = Type.Object({
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
export function formatFirefoxDate(timestamp: number): string {
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
async function withFirefoxDb<TResult>(
  sql: string,
  rowMapper: (row: unknown) => TResult,
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
      const rows = db.prepare(sql).all();
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

export async function getBookmarksFromDB(query?: string): Promise<Bookmark[]> {
  const allBookmarks = await withFirefoxDb<Bookmark>(
    `SELECT b.id, p.url, b.title, MAX(b.dateAdded) as dateAdded
     FROM moz_bookmarks b
     JOIN moz_places p ON b.fk = p.id
     WHERE p.url LIKE 'http%' OR p.url LIKE 'https%'
     GROUP BY p.url
     ORDER BY dateAdded DESC
     LIMIT 1000`,
    (row) => {
      const bookmarkRow = row as BookmarkRowWithUrl;
      return {
        id: String(bookmarkRow.id),
        title: bookmarkRow.title || new URL(bookmarkRow.url).hostname,
        url: bookmarkRow.url,
        domain: extractDomain(bookmarkRow.url),
        dateAdded: bookmarkRow.dateAdded || Date.now(),
      };
    },
  );

  if (!query) return allBookmarks;

  return fuzzyFilter(allBookmarks, query, (b) => b.title).map((r) => r.item);
}

async function getHistoryFromDB(query?: string): Promise<History[]> {
  const allHistory = await withFirefoxDb<History>(
    `SELECT p.id, p.url, p.title, p.visit_count as visitCount, MAX(p.last_visit_date) as lastVisit
     FROM moz_places p
     WHERE (p.url LIKE 'http%' OR p.url LIKE 'https%')
       AND p.visit_count > 0
       AND p.last_visit_date > 0
     GROUP BY p.url
     ORDER BY last_visit_date DESC
     LIMIT 1000`,
    (row) => {
      const historyRow = row as HistoryRowWithUrl;
      return {
        id: String(historyRow.id),
        title: historyRow.title || new URL(historyRow.url).hostname,
        url: historyRow.url,
        domain: extractDomain(historyRow.url),
        visitCount: historyRow.visitCount || 0,
        lastVisit: historyRow.lastVisit || 0,
      };
    },
  );

  if (!query) return allHistory;

  return fuzzyFilter(allHistory, query, (e) => `${e.title} ${e.url}`).map(
    (r) => r.item,
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

          const shown = bookmarks.slice(0, limit);

          if (shown.length === 0) {
            return {
              content: [{ type: "text", text: "No bookmarks found" }],
              details: { query, totalFound: 0 },
            };
          }

          const header =
            bookmarks.length > limit
              ? `${countLabel(shown.length, "result")} (of ${bookmarks.length})`
              : countLabel(shown.length, "result");
          const headerLine = dotJoin(header);

          const cols: Column[] = [
            { key: "#", align: "right", minWidth: 3 },
            { key: "added", minWidth: 10 },
            {
              key: "title",
              format: (_v, row) => {
                const r = row as { title: string; url: string };
                return `${r.title}\n${r.url}`;
              },
            },
          ];

          const rows = shown.map((bm, i) => ({
            "#": String(i + 1),
            added: formatFirefoxDate(bm.dateAdded),
            title: bm.title,
            url: bm.url,
          }));

          const text = [headerLine, "", table(cols, rows)].join("\n");

          return {
            content: [{ type: "text", text }],
            details: { query, totalFound: bookmarks.length },
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

          const shown = history.slice(0, limit);

          if (shown.length === 0) {
            return {
              content: [{ type: "text", text: "No history found" }],
              details: { query, totalFound: 0 },
            };
          }

          const header =
            history.length > limit
              ? `${countLabel(shown.length, "result")} (of ${history.length})`
              : countLabel(shown.length, "result");
          const headerLine = dotJoin(header);

          const cols: Column[] = [
            { key: "#", align: "right", minWidth: 3 },
            { key: "󰈈", align: "right", minWidth: 6 },
            { key: "last visit", minWidth: 10 },
            {
              key: "title",
              format: (_v, row) => {
                const r = row as { title: string; url: string };
                return `${r.title}\n${r.url}`;
              },
            },
          ];

          const rows = shown.map((entry, i) => ({
            "#": String(i + 1),
            "󰈈": String(entry.visitCount),
            "last visit": formatFirefoxDate(entry.lastVisit),
            title: entry.title,
            url: entry.url,
          }));

          const text = [headerLine, "", table(cols, rows)].join("\n");

          return {
            content: [{ type: "text", text }],
            details: { query, totalFound: history.length },
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
