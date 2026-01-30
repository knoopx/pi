/**
 * Himalaya Mail Extension
 *
 * Provides tools to check and read email using the himalaya CLI.
 *
 * Tools:
 *   - mail_list: List envelopes (emails) in a folder
 *   - mail_read: Read a specific message by ID
 *   - mail_folders: List available mail folders
 *   - mail_accounts: List configured mail accounts
 *   - mail_search: Search emails with query filters
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

interface Envelope {
  id: string;
  flags: string[];
  subject: string;
  from: { name?: string; addr: string };
  to: { name?: string; addr: string }[];
  date: string;
}

interface Folder {
  name: string;
  desc?: string;
}

interface Account {
  name: string;
  backend: string;
  default: boolean;
}

export default function himalayaMailExtension(pi: ExtensionAPI) {
  // Helper to run himalaya commands
  async function runHimalaya(
    args: string[],
    signal?: AbortSignal,
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const result = await pi.exec("himalaya", [...args, "-o", "json"], {
      signal,
      timeout: 30000,
    });

    if (result.code !== 0) {
      return {
        success: false,
        output: "",
        error: result.stderr || `Command failed with code ${result.code}`,
      };
    }

    return { success: true, output: result.stdout };
  }

  // Tool: List mail envelopes
  pi.registerTool({
    name: "mail_list",
    label: "List Mail",
    description:
      "List email envelopes (message summaries) in a folder. Returns subject, from, date, and flags for each message.",
    parameters: Type.Object({
      folder: Type.Optional(
        Type.String({ description: "Folder name (default: INBOX)" }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name (uses default if not specified)",
        }),
      ),
      page: Type.Optional(
        Type.Number({ description: "Page number (default: 1)" }),
      ),
      pageSize: Type.Optional(
        Type.Number({ description: "Number of emails per page (default: 10)" }),
      ),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const args = ["envelope", "list"];

      if (params.folder) args.push("-f", params.folder);
      if (params.account) args.push("-a", params.account);
      if (params.page) args.push("-p", String(params.page));
      if (params.pageSize) args.push("-s", String(params.pageSize));

      const result = await runHimalaya(args, signal);

      if (!result.success) {
        return {
          content: [
            { type: "text", text: `Error listing mail: ${result.error}` },
          ],
          details: { error: result.error },
          isError: true,
        };
      }

      try {
        const envelopes: Envelope[] = JSON.parse(result.output);
        const formatted = envelopes
          .map((e) => {
            const flags = e.flags.length ? `[${e.flags.join(", ")}]` : "";
            const from = e.from.name || e.from.addr;
            return `• ${e.id}: ${flags} ${e.subject}\n  From: ${from} | ${e.date}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: envelopes.length
                ? `Found ${envelopes.length} email(s):\n\n${formatted}`
                : "No emails found.",
            },
          ],
          details: { envelopes, count: envelopes.length },
        };
      } catch {
        return {
          content: [{ type: "text", text: result.output }],
          details: { raw: result.output },
        };
      }
    },
  });

  // Tool: Read a specific message
  pi.registerTool({
    name: "mail_read",
    label: "Read Mail",
    description:
      "Read the full content of an email message by its envelope ID. Use mail_list first to get message IDs.",
    parameters: Type.Object({
      id: Type.String({ description: "The envelope/message ID to read" }),
      folder: Type.Optional(
        Type.String({ description: "Folder name (default: INBOX)" }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name (uses default if not specified)",
        }),
      ),
      preview: Type.Optional(
        Type.Boolean({
          description: "If true, don't mark as read (default: false)",
        }),
      ),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const args = ["message", "read", params.id];

      if (params.folder) args.push("-f", params.folder);
      if (params.account) args.push("-a", params.account);
      if (params.preview) args.push("-p");

      // Don't use JSON output for message read - it's better as plain text
      const result = await pi.exec("himalaya", args, {
        signal,
        timeout: 30000,
      });

      if (result.code !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `Error reading message: ${result.stderr || `Exit code ${result.code}`}`,
            },
          ],
          details: { error: result.stderr },
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: result.stdout }],
        details: { messageId: params.id },
      };
    },
  });

  // Tool: List folders
  pi.registerTool({
    name: "mail_folders",
    label: "List Folders",
    description: "List all available mail folders/mailboxes for the account.",
    parameters: Type.Object({
      account: Type.Optional(
        Type.String({
          description: "Account name (uses default if not specified)",
        }),
      ),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const args = ["folder", "list"];
      if (params.account) args.push("-a", params.account);

      const result = await runHimalaya(args, signal);

      if (!result.success) {
        return {
          content: [
            { type: "text", text: `Error listing folders: ${result.error}` },
          ],
          details: { error: result.error },
          isError: true,
        };
      }

      try {
        const folders: Folder[] = JSON.parse(result.output);
        const formatted = folders.map((f) => `• ${f.name}`).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Available folders:\n\n${formatted}`,
            },
          ],
          details: { folders, count: folders.length },
        };
      } catch {
        return {
          content: [{ type: "text", text: result.output }],
          details: { raw: result.output },
        };
      }
    },
  });

  // Tool: List accounts
  pi.registerTool({
    name: "mail_accounts",
    label: "List Accounts",
    description: "List all configured mail accounts.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _onUpdate, _ctx, signal) {
      const result = await runHimalaya(["account", "list"], signal);

      if (!result.success) {
        return {
          content: [
            { type: "text", text: `Error listing accounts: ${result.error}` },
          ],
          details: { error: result.error },
          isError: true,
        };
      }

      try {
        const accounts: Account[] = JSON.parse(result.output);
        const formatted = accounts
          .map(
            (a) => `• ${a.name}${a.default ? " (default)" : ""} [${a.backend}]`,
          )
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Configured accounts:\n\n${formatted}`,
            },
          ],
          details: { accounts, count: accounts.length },
        };
      } catch {
        return {
          content: [{ type: "text", text: result.output }],
          details: { raw: result.output },
        };
      }
    },
  });

  // Tool: Search emails
  pi.registerTool({
    name: "mail_search",
    label: "Search Mail",
    description: `Search emails with query filters. Query examples:
- subject foo: find emails with "foo" in subject
- from user@example.com: find emails from sender
- body keyword: find emails containing "keyword" in body
- flag unseen: find unread emails
- before 2024-01-01: emails before date
- after 2024-01-01: emails after date
- subject foo and body bar: combine conditions
- not flag seen: negate conditions
- order by date desc: sort results`,
    parameters: Type.Object({
      query: Type.String({
        description:
          "Search query (e.g., 'subject foo', 'from user@example.com', 'flag unseen')",
      }),
      folder: Type.Optional(
        Type.String({ description: "Folder name (default: INBOX)" }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account name (uses default if not specified)",
        }),
      ),
      pageSize: Type.Optional(
        Type.Number({ description: "Maximum results to return (default: 10)" }),
      ),
    }),
    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const args = ["envelope", "list"];

      if (params.folder) args.push("-f", params.folder);
      if (params.account) args.push("-a", params.account);
      if (params.pageSize) args.push("-s", String(params.pageSize));

      // Add query at the end
      args.push(...params.query.split(" "));

      const result = await runHimalaya(args, signal);

      if (!result.success) {
        return {
          content: [
            { type: "text", text: `Error searching mail: ${result.error}` },
          ],
          details: { error: result.error, query: params.query },
          isError: true,
        };
      }

      try {
        const envelopes: Envelope[] = JSON.parse(result.output);
        const formatted = envelopes
          .map((e) => {
            const flags = e.flags.length ? `[${e.flags.join(", ")}]` : "";
            const from = e.from.name || e.from.addr;
            return `• ${e.id}: ${flags} ${e.subject}\n  From: ${from} | ${e.date}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: envelopes.length
                ? `Search results for "${params.query}":\n\n${formatted}`
                : `No emails found matching "${params.query}".`,
            },
          ],
          details: { envelopes, count: envelopes.length, query: params.query },
        };
      } catch {
        return {
          content: [{ type: "text", text: result.output }],
          details: { raw: result.output, query: params.query },
        };
      }
    },
  });
}
