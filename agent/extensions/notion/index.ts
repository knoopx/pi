/**
 * Notion extension - query and fetch pages from Notion via API.
 *
 * Tools:
 *   notion-search       - search pages and databases by query
 *   notion-get-page     - get page properties and content (blocks)
 *   notion-list-databases - list all databases the integration can access
 *   notion-query-database - query a database with optional filters
 *
 * Requires NOTION_API_KEY environment variable.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { textResult, errorResult } from "../../shared/tool-utils";
import { throttledFetch } from "../../shared/throttle";

const NOTION_API_VERSION = "2025-09-03";
const NOTION_BASE_URL = "https://api.notion.com/v1";

function getApiKey(): string {
  const key = process.env.NOTION_API_KEY;
  if (!key) {
    throw new Error(
      "NOTION_API_KEY environment variable is required. " +
        "Create an integration at https://www.notion.so/my-integrations",
    );
  }
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Notion-Version": NOTION_API_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;
  const url = `${NOTION_BASE_URL}${endpoint}`;

  const response = await throttledFetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as {
      message?: string;
      code?: string;
    };
    throw new Error(
      error.message ||
        `Notion API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

// Types for Notion API responses
interface NotionRichText {
  type: string;
  text?: { content: string; link?: { url: string } | null };
  plain_text: string;
  annotations?: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
}

interface NotionUser {
  id: string;
  name?: string;
  type: string;
}

interface NotionParent {
  type: string;
  database_id?: string;
  page_id?: string;
  workspace?: boolean;
}

interface NotionPage {
  id: string;
  object: "page";
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  url: string;
  parent: NotionParent;
  properties: Record<string, NotionProperty>;
}

interface NotionDatabase {
  id: string;
  object: "database";
  title: NotionRichText[];
  description: NotionRichText[];
  created_time: string;
  last_edited_time: string;
  url: string;
  parent: NotionParent;
  properties: Record<string, NotionPropertySchema>;
}

interface NotionPropertySchema {
  id: string;
  name: string;
  type: string;
}

interface NotionProperty {
  id: string;
  type: string;
  title?: NotionRichText[];
  rich_text?: NotionRichText[];
  number?: number | null;
  select?: { name: string; color: string } | null;
  multi_select?: { name: string; color: string }[];
  date?: { start: string; end?: string | null } | null;
  checkbox?: boolean;
  url?: string | null;
  email?: string | null;
  phone_number?: string | null;
  created_time?: string;
  last_edited_time?: string;
  created_by?: NotionUser;
  last_edited_by?: NotionUser;
  formula?: { type: string; string?: string; number?: number; boolean?: boolean };
  relation?: { id: string }[];
  rollup?: { type: string; array?: unknown[]; number?: number; date?: { start: string } };
  people?: NotionUser[];
  files?: { name: string; type: string; file?: { url: string } }[];
  status?: { name: string; color: string } | null;
}

interface NotionBlock {
  id: string;
  object: "block";
  type: string;
  has_children: boolean;
  archived: boolean;
  paragraph?: { rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[] };
  numbered_list_item?: { rich_text: NotionRichText[] };
  to_do?: { rich_text: NotionRichText[]; checked: boolean };
  toggle?: { rich_text: NotionRichText[] };
  code?: { rich_text: NotionRichText[]; language: string };
  quote?: { rich_text: NotionRichText[] };
  callout?: { rich_text: NotionRichText[]; icon?: { emoji?: string } };
  divider?: object;
  table_of_contents?: object;
  child_page?: { title: string };
  child_database?: { title: string };
  image?: { type: string; file?: { url: string }; external?: { url: string } };
  bookmark?: { url: string; caption: NotionRichText[] };
  link_preview?: { url: string };
}

interface NotionSearchResponse {
  object: "list";
  results: (NotionPage | NotionDatabase)[];
  next_cursor: string | null;
  has_more: boolean;
}

interface NotionBlocksResponse {
  object: "list";
  results: NotionBlock[];
  next_cursor: string | null;
  has_more: boolean;
}

interface NotionDatabaseQueryResponse {
  object: "list";
  results: NotionPage[];
  next_cursor: string | null;
  has_more: boolean;
}

// Helpers - exported for testing

export function extractPlainText(richText: NotionRichText[]): string {
  return richText.map((rt) => rt.plain_text).join("");
}

export function getPageTitle(page: NotionPage): string {
  const titleProp = Object.values(page.properties).find((p) => p.type === "title");
  if (titleProp?.title) {
    return extractPlainText(titleProp.title);
  }
  return "Untitled";
}

export function formatProperty(prop: NotionProperty): string {
  switch (prop.type) {
    case "title":
      return prop.title ? extractPlainText(prop.title) : "";
    case "rich_text":
      return prop.rich_text ? extractPlainText(prop.rich_text) : "";
    case "number":
      return prop.number != null ? String(prop.number) : "";
    case "select":
      return prop.select?.name ?? "";
    case "multi_select":
      return prop.multi_select?.map((s) => s.name).join(", ") ?? "";
    case "date":
      if (!prop.date) return "";
      return prop.date.end
        ? `${prop.date.start} → ${prop.date.end}`
        : prop.date.start;
    case "checkbox":
      return prop.checkbox ? "✓" : "✗";
    case "url":
      return prop.url ?? "";
    case "email":
      return prop.email ?? "";
    case "phone_number":
      return prop.phone_number ?? "";
    case "created_time":
      return prop.created_time ?? "";
    case "last_edited_time":
      return prop.last_edited_time ?? "";
    case "people":
      return prop.people?.map((p) => p.name ?? p.id).join(", ") ?? "";
    case "files":
      return prop.files?.map((f) => f.name).join(", ") ?? "";
    case "status":
      return prop.status?.name ?? "";
    case "formula":
      if (prop.formula?.string) return prop.formula.string;
      if (prop.formula?.number != null) return String(prop.formula.number);
      if (prop.formula?.boolean != null) return prop.formula.boolean ? "true" : "false";
      return "";
    case "relation":
      return prop.relation?.map((r) => r.id).join(", ") ?? "";
    default:
      return `[${prop.type}]`;
  }
}

export function blockToText(block: NotionBlock, indent = 0): string {
  const prefix = "  ".repeat(indent);
  const type = block.type;

  switch (type) {
    case "paragraph":
      return prefix + extractPlainText(block.paragraph?.rich_text ?? []);
    case "heading_1":
      return prefix + "# " + extractPlainText(block.heading_1?.rich_text ?? []);
    case "heading_2":
      return prefix + "## " + extractPlainText(block.heading_2?.rich_text ?? []);
    case "heading_3":
      return prefix + "### " + extractPlainText(block.heading_3?.rich_text ?? []);
    case "bulleted_list_item":
      return prefix + "- " + extractPlainText(block.bulleted_list_item?.rich_text ?? []);
    case "numbered_list_item":
      return prefix + "1. " + extractPlainText(block.numbered_list_item?.rich_text ?? []);
    case "to_do": {
      const checked = block.to_do?.checked ? "[x]" : "[ ]";
      return prefix + "- " + checked + " " + extractPlainText(block.to_do?.rich_text ?? []);
    }
    case "toggle":
      return prefix + "<details><summary>" + extractPlainText(block.toggle?.rich_text ?? []) + "</summary></details>";
    case "code": {
      const lang = block.code?.language ?? "";
      const code = extractPlainText(block.code?.rich_text ?? []);
      return `${prefix}\`\`\`${lang}\n${code}\n${prefix}\`\`\``;
    }
    case "quote":
      return prefix + "> " + extractPlainText(block.quote?.rich_text ?? []);
    case "callout": {
      const icon = block.callout?.icon?.emoji ?? "💡";
      return prefix + "> " + icon + " " + extractPlainText(block.callout?.rich_text ?? []);
    }
    case "divider":
      return prefix + "---";
    case "child_page":
      return prefix + "- 📄 " + (block.child_page?.title ?? "Untitled");
    case "child_database":
      return prefix + "- 📊 " + (block.child_database?.title ?? "Untitled");
    case "image": {
      const url = block.image?.file?.url ?? block.image?.external?.url ?? "";
      return prefix + `![image](${url})`;
    }
    case "bookmark": {
      const url = block.bookmark?.url ?? "";
      return prefix + `[${url}](${url})`;
    }
    case "link_preview": {
      const url = block.link_preview?.url ?? "";
      return prefix + `[${url}](${url})`;
    }
    case "table_of_contents":
      return prefix + "*[Table of Contents]*";
    default:
      return prefix + `*[${type} block]*`;
  }
}

export function normalizeNotionId(id: string): string {
  const stripped = id.replace(/-/g, "");
  if (stripped.length === 32) {
    return `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(12, 16)}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
  }
  return id;
}

export function formatSearchResult(item: NotionPage | NotionDatabase): string {
  if (item.object === "page") {
    const title = getPageTitle(item);
    return `- **${title}** (page)\n  - ID: \`${item.id}\`\n  - URL: ${item.url}`;
  } else {
    const title = extractPlainText(item.title);
    return `- **${title}** (database)\n  - ID: \`${item.id}\`\n  - URL: ${item.url}`;
  }
}

export default function notionExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "notion-search",
    label: "Notion Search",
    description: `Search Notion pages and databases by query.

Use this to:
- Find pages by title or content
- Search for databases
- Discover content in the workspace

Requires NOTION_API_KEY environment variable.`,
    parameters: Type.Object({
      query: Type.String({ description: "Search query text" }),
      filter: Type.Optional(
        StringEnum(["page", "database"] as const, {
          description: "Filter results by type",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum results (default 10, max 100)",
          minimum: 1,
          maximum: 100,
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      try {
        const body: Record<string, unknown> = {
          query: params.query,
          page_size: params.limit ?? 10,
        };

        if (params.filter) {
          body.filter = { value: params.filter, property: "object" };
        }

        const response = await notionRequest<NotionSearchResponse>(
          "/search",
          { method: "POST", body, signal },
        );

        if (response.results.length === 0) {
          return textResult(`No results found for "${params.query}"`, {
            query: params.query,
            count: 0,
          });
        }

        const lines = [
          `Found ${response.results.length} result(s):`,
          "",
          ...response.results.map(formatSearchResult),
        ];

        return textResult(lines.join("\n"), {
          query: params.query,
          count: response.results.length,
          results: response.results.map((r) => ({
            id: r.id,
            type: r.object,
            title:
              r.object === "page"
                ? getPageTitle(r)
                : extractPlainText((r).title),
            url: r.url,
          })),
        });
      } catch (error) {
        return errorResult(error, { query: params.query });
      }
    },
  });

  pi.registerTool({
    name: "notion-get-page",
    label: "Notion Get Page",
    description: `Get a Notion page's properties and content blocks.

Use this to:
- Read page content as plain text
- Get page properties
- Navigate page structure

Requires NOTION_API_KEY environment variable.`,
    parameters: Type.Object({
      pageId: Type.String({
        description: "Page ID (UUID format, with or without dashes)",
      }),
      includeContent: Type.Optional(
        Type.Boolean({
          description: "Include page blocks/content (default true)",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      try {
        const formattedId = normalizeNotionId(params.pageId);

        // Get page properties
        const page = await notionRequest<NotionPage>(`/pages/${formattedId}`, {
          signal,
        });

        const title = getPageTitle(page);
        const lines: string[] = [
          `# ${title}`,
          "",
          `- **URL:** ${page.url}`,
          `- **Created:** ${page.created_time}`,
          `- **Last edited:** ${page.last_edited_time}`,
        ];

        // Add properties
        const props = Object.entries(page.properties)
          .filter(([, p]) => p.type !== "title")
          .map(([name, prop]) => `- **${name}:** ${formatProperty(prop)}`)
          .filter((line) => !line.endsWith(": "));

        if (props.length > 0) {
          lines.push("", "## Properties", "", ...props);
        }

        // Get content blocks
        if (params.includeContent !== false) {
          const blocks = await notionRequest<NotionBlocksResponse>(
            `/blocks/${formattedId}/children?page_size=100`,
            { signal },
          );

          if (blocks.results.length > 0) {
            lines.push("", "## Content", "");
            lines.push(...blocks.results.map((b) => blockToText(b)));
          }
        }

        return textResult(lines.join("\n"), {
          pageId: page.id,
          title,
          url: page.url,
          properties: Object.fromEntries(
            Object.entries(page.properties).map(([k, v]) => [k, formatProperty(v)]),
          ),
        });
      } catch (error) {
        return errorResult(error, { pageId: params.pageId });
      }
    },
  });

  pi.registerTool({
    name: "notion-list-databases",
    label: "Notion List Databases",
    description: `List all databases the integration can access.

Use this to:
- Discover available databases
- Get database IDs for querying
- See database schemas

Requires NOTION_API_KEY environment variable.`,
    parameters: Type.Object({
      limit: Type.Optional(
        Type.Number({
          description: "Maximum results (default 50, max 100)",
          minimum: 1,
          maximum: 100,
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      try {
        const response = await notionRequest<NotionSearchResponse>("/search", {
          method: "POST",
          body: {
            filter: { value: "database", property: "object" },
            page_size: params.limit ?? 50,
          },
          signal,
        });

        if (response.results.length === 0) {
          return textResult(
            "No databases found. Make sure the integration has access to databases.",
            { count: 0 },
          );
        }

        const databases = response.results as NotionDatabase[];
        const lines = [
          `Found ${databases.length} database(s):`,
          "",
          ...databases.map((db) => {
            const title = extractPlainText(db.title);
            const propNames = Object.keys(db.properties).join("`, `");
            return `- **${title}**\n  - ID: \`${db.id}\`\n  - Properties: \`${propNames}\`\n  - URL: ${db.url}`;
          }),
        ];

        return textResult(lines.join("\n"), {
          count: databases.length,
          databases: databases.map((db) => ({
            id: db.id,
            title: extractPlainText(db.title),
            url: db.url,
            properties: Object.keys(db.properties),
          })),
        });
      } catch (error) {
        return errorResult(error);
      }
    },
  });

  pi.registerTool({
    name: "notion-query-database",
    label: "Notion Query Database",
    description: `Query a Notion database with optional filters and sorting.

Use this to:
- List entries in a database
- Filter by property values
- Sort results

Requires NOTION_API_KEY environment variable.`,
    parameters: Type.Object({
      databaseId: Type.String({
        description: "Database ID (UUID format)",
      }),
      filter: Type.Optional(
        Type.String({
          description:
            "Filter object as JSON string (see Notion API filter syntax)",
        }),
      ),
      sorts: Type.Optional(
        Type.String({
          description:
            "Sort array as JSON string (e.g., '[{\"property\":\"Name\",\"direction\":\"ascending\"}]')",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum results (default 50, max 100)",
          minimum: 1,
          maximum: 100,
        }),
      ),
    }),

    async execute(_toolCallId, params, signal) {
      try {
        const formattedId = normalizeNotionId(params.databaseId);

        const body: Record<string, unknown> = {
          page_size: params.limit ?? 50,
        };

        if (params.filter) {
          body.filter = JSON.parse(params.filter) as unknown;
        }

        if (params.sorts) {
          body.sorts = JSON.parse(params.sorts) as unknown;
        }

        const response = await notionRequest<NotionDatabaseQueryResponse>(
          `/databases/${formattedId}/query`,
          { method: "POST", body, signal },
        );

        if (response.results.length === 0) {
          return textResult("No entries found in database.", {
            databaseId: params.databaseId,
            count: 0,
          });
        }

        const lines = [`Found ${response.results.length} entry/entries:`, ""];

        for (const page of response.results) {
          const title = getPageTitle(page);
          const props = Object.entries(page.properties)
            .filter(([, p]) => p.type !== "title")
            .map(([name, prop]) => {
              const val = formatProperty(prop);
              return val ? `**${name}:** ${val}` : null;
            })
            .filter(Boolean);

          lines.push(`- **${title}**`);
          lines.push(`  - ID: \`${page.id}\``);
          if (props.length > 0) {
            lines.push(`  - ${props.join(" | ")}`);
          }
        }

        return textResult(lines.join("\n"), {
          databaseId: params.databaseId,
          count: response.results.length,
          entries: response.results.map((p) => ({
            id: p.id,
            title: getPageTitle(p),
            url: p.url,
            properties: Object.fromEntries(
              Object.entries(p.properties).map(([k, v]) => [k, formatProperty(v)]),
            ),
          })),
        });
      } catch (error) {
        return errorResult(error, { databaseId: params.databaseId });
      }
    },
  });
}
