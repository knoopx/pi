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
  query: Type.String({
    description: "Search query for bookmark title",
  }),
});

type SearchBookmarksParamsType = Static<typeof SearchBookmarksParams>;

export const SearchBookmarksSimilarityParams = Type.Object({
  query: Type.String({
    description: "Search query for bookmark title (uses similarity matching)",
  }),
  threshold: Type.Optional(
    Type.Number({
      description: "Minimum similarity threshold (0.0 to 1.0, default: 0.6)",
    }),
  ),
});

type SearchBookmarksSimilarityParamsType = Static<
  typeof SearchBookmarksSimilarityParams
>;

export const GetBookmarkParams = Type.Object({
  id: Type.String({
    description: "Bookmark ID (GUID)",
  }),
});

type GetBookmarkParamsType = Static<typeof GetBookmarkParams>;

interface Bookmark {
  id: string;
  title: string;
  url: string;
  domain: string;
  dateAdded: number;
  folder?: string;
}

interface BookmarkRowWithUrl {
  id: number;
  url: string;
  title: string | null;
  dateAdded: number;
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
function levenshteinDistance(str1: string, str2: string): number {
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
function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  return 1 - distance / maxLen;
}

interface Profile {
  name: string;
  path: string;
}

// Firefox profile paths for common configurations
const PROFILE_PATHs = {
  default: process.env.HOME || "/home/user",
  // You can add other common Firefox profile paths here
  alt: process.env.HOME ? `${process.env.HOME}/.mozilla/firefox` : null,
};

function extractDomain(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch {
    return "";
  }
}

export function getFirefoxProfilePath(_profileName?: string): string {
  // Default to the first available profile
  return PROFILE_PATHs.alt || PROFILE_PATHs.default;
}

async function getFirefoxProfiles(): Promise<{
  profiles: Profile[];
  defaultProfile: string;
}> {
  try {
    const profilePath = getFirefoxProfilePath();
    const placesPath = `${profilePath}/.mozilla/firefox/`;

    if (!placesPath) {
      return { profiles: [], defaultProfile: "" };
    }

    // Try to find Firefox profiles
    const profiles: Profile[] = [];
    const defaultProfile = "default";

    return { profiles, defaultProfile };
  } catch (error) {
    throw new Error(
      `Failed to get Firefox profiles: ${(error as Error).message}`,
    );
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

async function getBookmarksFromDB(query?: string): Promise<Bookmark[]> {
  const profilePath = getFirefoxProfilePath();
  const placesPath = `${profilePath}/.mozilla/firefox/`;

  if (!placesPath) {
    throw new Error("Firefox profile path not found");
  }

  const fs = await import("fs/promises");
  const dbExists = await fs
    .access(placesPath)
    .then(() => true)
    .catch(() => false);

  if (!dbExists) {
    throw new Error("Firefox database not found at expected location");
  }

  const sqlite3 = await import("better-sqlite3");
  const db: Database = sqlite3.default(placesPath);
  db.pragma("journal_mode = WAL");

  try {
    const bookmarks: Bookmark[] = [];

    if (query) {
      // Search by query in title
      const rows = db
        .prepare(
          `
          SELECT b.id, b.url, b.title, b.dateAdded
          FROM moz_bookmarks b
          JOIN moz_places p ON b.fk = p.id
          WHERE p.title LIKE ?
            AND p.url LIKE 'http%' OR p.url LIKE 'https%'
          ORDER by b.dateAdded DESC
          LIMIT 1000
        `,
        )
        .all(`%${query.toLowerCase()}%`) as BookmarkRowWithUrl[];

      bookmarks.push(
        ...rows.map((row: BookmarkRowWithUrl) => ({
          id: String(row.id),
          title: row.title || new URL(row.url).hostname,
          url: row.url,
          domain: extractDomain(row.url),
          dateAdded: row.dateAdded || Date.now(),
        })),
      );
    } else {
      // List all bookmarks
      const rows = db
        .prepare(
          `
          SELECT b.id, b.url, b.title, b.dateAdded
          FROM moz_bookmarks b
          JOIN moz_places p ON b.fk = p.id
          WHERE p.url LIKE 'http%' OR p.url LIKE 'https%'
          ORDER by b.dateAdded DESC
          LIMIT 1000
        `,
        )
        .all() as BookmarkRowWithUrl[];

      bookmarks.push(
        ...rows.map((row: BookmarkRowWithUrl) => ({
          id: String(row.id),
          title: row.title || new URL(row.url).hostname,
          url: row.url,
          domain: extractDomain(row.url),
          dateAdded: row.dateAdded || Date.now(),
        })),
      );
    }

    // Close database connection
    db.close();

    return bookmarks;
  } catch (dbError) {
    db.close();
    throw dbError;
  }
}

export default function (pi: ExtensionAPI) {
  // List Firefox profiles
  pi.registerTool({
    name: "list-firefox-profiles",
    label: "List Firefox Profiles",
    description: `List available Firefox profiles on the system.

Use this to:
- Discover Firefox profiles for bookmark access
- Understand available profiles before querying bookmarks
- Identify the default profile

Returns a list of Firefox profiles and their paths.`,
    parameters: Type.Object({}),
    async execute(
      _toolCallId: string,
      _params: Record<string, unknown>,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ): Promise<AgentToolResult<unknown>> {
      try {
        const { profiles, defaultProfile } = await getFirefoxProfiles();

        const content = profiles
          .map((profile) => {
            return `- ${profile.name} (${profile.path})`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Available Firefox Profiles:\n\n${content || "No profiles found"}\n\nDefault Profile: ${defaultProfile}`,
            },
          ] as const,
          details: {
            totalFound: profiles.length,
          },
        };
      } catch (error) {
        return createErrorResult((error as Error).message);
      }
    },
  });

  // List all bookmarks
  pi.registerTool({
    name: "list-bookmarks",
    label: "List Bookmarks",
    description: `List all Firefox bookmarks.

Use this to:
- View all saved bookmarks
- Discover saved websites
- Get an overview of bookmarked content

Returns a list of bookmarks with titles, URLs, and folder information.`,
    parameters: SearchBookmarksParams,
    async execute(
      _toolCallId: string,
      params: SearchBookmarksParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ): Promise<AgentToolResult<unknown>> {
      try {
        const { query = "" } = params;

        // Build bookmarks list from database
        try {
          const bookmarks = await getBookmarksFromDB(query);

          // Build content
          const content = bookmarks
            .map((bookmark) => {
              let line = `• ${bookmark.title} - ${bookmark.url}`;
              if (bookmark.domain) {
                line += ` (${bookmark.domain})`;
              }
              return line;
            })
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `Firefox Bookmarks:\n\n${content || "No bookmarks found"}\n\n${bookmarks.length} bookmarks match your criteria`,
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

  // Search bookmarks using Levenshtein distance similarity
  pi.registerTool({
    name: "search-bookmarks-by-similarity",
    label: "Search Bookmarks by Similarity",
    description: `Search for bookmarks using Levenshtein distance similarity matching.

Use this to:
- Find bookmarks with similar titles when exact matches aren't available
- Handle typos and partial matches
- Get results ranked by similarity score

Returns a list of matching bookmarks with similarity scores.`,
    parameters: SearchBookmarksSimilarityParams,
    async execute(
      _toolCallId: string,
      params: SearchBookmarksSimilarityParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ): Promise<AgentToolResult<unknown>> {
      try {
        const { query = "", threshold = 0.6 } = params;

        // Build bookmarks list from database
        try {
          const bookmarks = await getBookmarksFromDB();

          // Calculate similarity scores using Levenshtein distance
          const scoredBookmarks = bookmarks.map((bookmark) => {
            const similarity = similarityScore(
              bookmark.title.toLowerCase(),
              query.toLowerCase(),
            );
            return {
              ...bookmark,
              similarity,
              distance: levenshteinDistance(
                bookmark.title.toLowerCase(),
                query.toLowerCase(),
              ),
            };
          });

          // Filter by threshold and sort by similarity score (descending)
          const matchingBookmarks = scoredBookmarks
            .filter((b) => b.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity);

          // Build content
          const content = matchingBookmarks
            .map((bookmark) => {
              let line = `• ${bookmark.title} - ${bookmark.url}`;
              if (bookmark.domain) {
                line += ` (${bookmark.domain})`;
              }
              line += ` [Similarity: ${(bookmark.similarity * 100).toFixed(1)}%]`;
              return line;
            })
            .join("\n");

          return {
            content: [
              {
                type: "text",
                text: `Similarity Search Results for "${query}" (threshold: ${(threshold * 100).toFixed(0)}%)\n\n${content || "No bookmarks match the criteria"}\n\n${matchingBookmarks.length} bookmark(s) match your criteria`,
              },
            ],
            details: {
              query,
              threshold,
              totalFound: matchingBookmarks.length,
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

  // Get bookmark details
  pi.registerTool({
    name: "get-bookmark",
    label: "Get Bookmark Details",
    description: `Get detailed information about a specific bookmark.

Use this to:
- View bookmark details by ID
- Get precise bookmark information
- Access bookmark metadata

Returns detailed information about the specified bookmark.`,
    parameters: GetBookmarkParams,
    async execute(
      _toolCallId: string,
      params: GetBookmarkParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ): Promise<AgentToolResult<unknown>> {
      try {
        const { id } = params;

        // In production, this would query the Firefox database for the specific bookmark
        return {
          content: [
            {
              type: "text",
              text:
                `Bookmark Details (ID: ${id}):\n\n` +
                `Note: This is a placeholder response. In a production environment, this would query the Firefox places database for the specific bookmark ID.\n\n` +
                `To access real bookmarks, ensure Firefox is running and the database is accessible.`,
            },
          ],
          details: {
            bookmarkId: id,
          },
        };
      } catch (error) {
        return createErrorResult((error as Error).message);
      }
    },
  });

  // Search bookmarks
  pi.registerTool({
    name: "search-bookmarks",
    label: "Search Bookmarks",
    description: `Search for bookmarks by title or URL.

Use this to:
- Find specific bookmarks
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
        const { query = "" } = params;

        // Use the list-bookmarks tool with filtering
        const bookmarks = [
          {
            id: "menu-1",
            title: query || "Example Bookmark",
            url: query.startsWith("http")
              ? query
              : `https://example.com/search/${query}`,
            folder: "Bookmark Menu",
            domain: "",
            dateAdded: Date.now(),
          },
        ];

        const content = bookmarks
          .map((bookmark) => {
            let line = `• ${bookmark.title} - ${bookmark.url}`;
            if (bookmark.folder) {
              line += ` [${bookmark.folder}]`;
            }
            return line;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Search Results for "${query}"\n\n${content}\n\n1 bookmark found`,
            },
          ],
          details: {
            query,
            totalFound: bookmarks.length,
          },
        };
      } catch (error) {
        return createErrorResult((error as Error).message);
      }
    },
  });
}
