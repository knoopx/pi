import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolUpdateCallback,
  AgentToolResult,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

type GogToolResult<T = unknown> = AgentToolResult<T>;

interface GogError {
  error: string;
}

interface AccountInfo {
  email: string;
  client: string;
  scopes: string[];
}

function createErrorResult(message: string): GogToolResult<GogError> {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    details: { error: message },
  };
}

async function getAccounts(
  pi: ExtensionAPI,
  signal?: AbortSignal,
): Promise<AccountInfo[]> {
  try {
    const result = await pi.exec("gog", ["auth", "list"], { signal });
    const lines = result.stdout.trim().split("\n").filter(Boolean);
    return lines.map((line) => {
      const [email, client, scopesStr] = line.split("\t");
      return {
        email,
        client,
        scopes: scopesStr?.split(",") || [],
      };
    });
  } catch {
    return [];
  }
}

async function runGogCommand(
  pi: ExtensionAPI,
  args: string[],
  signal?: AbortSignal,
  account?: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    const fullArgs = account ? ["--account", account, ...args] : args;
    const result = await pi.exec("gog", fullArgs, { signal });
    return { stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(error.message || "Unknown error executing gog command");
    }
    throw new Error("Unknown error executing gog command");
  }
}

async function runGogJson<T>(
  pi: ExtensionAPI,
  args: string[],
  signal?: AbortSignal,
  account?: string,
): Promise<T> {
  const { stdout } = await runGogCommand(pi, args, signal, account);
  try {
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON output: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

interface AccountResult<T> {
  account: string;
  data: T;
  error?: string;
}

async function runGogJsonAllAccounts<T>(
  pi: ExtensionAPI,
  args: string[],
  signal?: AbortSignal,
  filterAccount?: string,
): Promise<AccountResult<T>[]> {
  const accounts = await getAccounts(pi, signal);
  if (accounts.length === 0) {
    throw new Error("No authenticated accounts found. Run 'gog auth' first.");
  }

  const targetAccounts = filterAccount
    ? accounts.filter((a) => a.email === filterAccount)
    : accounts;

  if (filterAccount && targetAccounts.length === 0) {
    throw new Error(`Account '${filterAccount}' not found`);
  }

  const results = await Promise.all(
    targetAccounts.map(async (acc) => {
      try {
        const data = await runGogJson<T>(pi, args, signal, acc.email);
        return { account: acc.email, data };
      } catch (error) {
        return {
          account: acc.email,
          data: null as T,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  return results;
}

function aggregateArrayResults<T extends object>(
  results: AccountResult<T[]>[],
): {
  items: (T & { _account: string })[];
  errors: { account: string; error: string }[];
} {
  const items: (T & { _account: string })[] = [];
  const errors: { account: string; error: string }[] = [];

  for (const result of results) {
    if (result.error) {
      errors.push({ account: result.account, error: result.error });
    } else if (Array.isArray(result.data)) {
      for (const item of result.data) {
        items.push({ ...item, _account: result.account });
      }
    }
  }

  return { items, errors };
}

function formatAggregatedResults<T extends object>(
  items: (T & { _account: string })[],
  errors: { account: string; error: string }[],
  emptyMessage: string,
): string {
  const parts: string[] = [];

  if (items.length > 0) {
    parts.push(items.map((item) => JSON.stringify(item)).join("\n"));
  } else {
    parts.push(emptyMessage);
  }

  if (errors.length > 0) {
    parts.push(
      "\nErrors:\n" +
        errors.map((e) => `  ${e.account}: ${e.error}`).join("\n"),
    );
  }

  return parts.join("\n");
}

export default function gogExtension(pi: ExtensionAPI) {
  // Helper to add optional account parameter
  const accountParam = Type.Optional(
    Type.String({
      description:
        "Account email to use (if not specified, queries all accounts)",
    }),
  );

  pi.registerTool({
    name: "list-google-drive-files",
    label: "List Google Drive Files",
    description: `List files in Google Drive (root or specific folder).

Use this to:
- Browse Google Drive file structure
- List files in a folder
- Get folder contents
- See file metadata`,
    parameters: Type.Object({
      parentId: Type.Optional(
        Type.String({ description: "Parent folder ID (default: root)" }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { parentId?: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["drive", "ls", "--json"];
        if (params.parentId) {
          args.push("--parent", params.parentId);
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No files found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { files: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-google-drive-file",
    label: "Get Google Drive File Details",
    description: `Get detailed information about a specific Google Drive file.

Use this to:
- Get file metadata
- See file size, MIME type, permissions
- Check file properties
- Retrieve file information by ID`,
    parameters: Type.Object({
      fileId: Type.String({ description: "Google Drive file ID" }),
      account: Type.Optional(
        Type.String({
          description:
            "Account email to use (required if file is not found in default account)",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { fileId: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        if (params.account) {
          const file = await runGogJson<unknown>(
            pi,
            ["drive", "get", "--json", params.fileId],
            signal,
            params.account,
          );
          const content = JSON.stringify(
            { ...(file as object), _account: params.account },
            null,
            2,
          );
          return {
            content: [{ type: "text", text: content }],
            details: { file, account: params.account },
          };
        }

        // Try all accounts to find the file
        const accounts = await getAccounts(pi, signal);
        for (const acc of accounts) {
          try {
            const file = await runGogJson<unknown>(
              pi,
              ["drive", "get", "--json", params.fileId],
              signal,
              acc.email,
            );
            const content = JSON.stringify(
              { ...(file as object), _account: acc.email },
              null,
              2,
            );
            return {
              content: [{ type: "text", text: content }],
              details: { file, account: acc.email },
            };
          } catch {
            continue;
          }
        }
        return createErrorResult(
          `File ${params.fileId} not found in any account`,
        );
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-google-drive-files",
    label: "Search Google Drive Files",
    description: `Full-text search across Google Drive.

Use this to:
- Find files by name or content
- Search across all Drive files
- Filter by file type or metadata
- Discover specific files quickly`,
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of results (default: 10)" }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { query: string; maxResults?: number; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["drive", "search", "--json", params.query];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No files found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { files: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-google-gmail-messages",
    label: "Search Gmail Messages",
    description: `Search Gmail threads using Gmail query syntax.

Use this to:
- Find emails by subject, sender, or content
- Search unread messages
- Filter by labels or date
- Find specific emails quickly`,
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({
          description:
            'Gmail search query (e.g., "is:unread", "from:me", "subject:meeting")',
        }),
      ),
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of results (default: 10)" }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { query?: string; maxResults?: number; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["gmail", "search", "--json"];
        if (params.query) {
          args.push(params.query);
        }
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No messages found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { messages: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-gmail-message",
    label: "Get Gmail Message Details",
    description: `Get full details of a specific Gmail message.

Use this to:
- View complete message content
- See message headers and metadata
- Read message body
- Get message information by ID`,
    parameters: Type.Object({
      messageId: Type.String({ description: "Gmail message ID" }),
      account: Type.Optional(
        Type.String({
          description:
            "Account email (required if message is from a specific account)",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { messageId: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        if (params.account) {
          const message = await runGogJson<unknown>(
            pi,
            ["gmail", "get", "--json", params.messageId],
            signal,
            params.account,
          );
          const content = JSON.stringify(
            { ...(message as object), _account: params.account },
            null,
            2,
          );
          return {
            content: [{ type: "text", text: content }],
            details: { message, account: params.account },
          };
        }

        // Try all accounts to find the message
        const accounts = await getAccounts(pi, signal);
        for (const acc of accounts) {
          try {
            const message = await runGogJson<unknown>(
              pi,
              ["gmail", "get", "--json", params.messageId],
              signal,
              acc.email,
            );
            const content = JSON.stringify(
              { ...(message as object), _account: acc.email },
              null,
              2,
            );
            return {
              content: [{ type: "text", text: content }],
              details: { message, account: acc.email },
            };
          } catch {
            continue;
          }
        }
        return createErrorResult(
          `Message ${params.messageId} not found in any account`,
        );
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-calendar-events",
    label: "List Calendar Events",
    description: `List events from a calendar.

Use this to:
- View calendar events
- Get event details
- See upcoming events
- Check calendar contents`,
    parameters: Type.Object({
      calendarId: Type.Optional(
        Type.String({ description: "Calendar ID (default: primary)" }),
      ),
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of events (default: 10)" }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { calendarId?: string; maxResults?: number; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["calendar", "list", "--json"];
        if (params.calendarId) {
          args.push("--calendar", params.calendarId);
        }
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No events found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { events: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-google-calendar-event",
    label: "Get Calendar Event Details",
    description: `Get details of a specific calendar event.

Use this to:
- View complete event information
- See event start/end times
- Get event attendees and location
- Retrieve event metadata by ID`,
    parameters: Type.Object({
      calendarId: Type.String({ description: "Calendar ID" }),
      eventId: Type.String({ description: "Event ID" }),
      account: Type.Optional(
        Type.String({
          description:
            "Account email (required if event is from a specific account)",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { calendarId: string; eventId: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        if (params.account) {
          const event = await runGogJson<unknown>(
            pi,
            [
              "calendar",
              "get",
              "--json",
              "--calendar",
              params.calendarId,
              params.eventId,
            ],
            signal,
            params.account,
          );
          const content = JSON.stringify(
            { ...(event as object), _account: params.account },
            null,
            2,
          );
          return {
            content: [{ type: "text", text: content }],
            details: { event, account: params.account },
          };
        }

        // Try all accounts
        const accounts = await getAccounts(pi, signal);
        for (const acc of accounts) {
          try {
            const event = await runGogJson<unknown>(
              pi,
              [
                "calendar",
                "get",
                "--json",
                "--calendar",
                params.calendarId,
                params.eventId,
              ],
              signal,
              acc.email,
            );
            const content = JSON.stringify(
              { ...(event as object), _account: acc.email },
              null,
              2,
            );
            return {
              content: [{ type: "text", text: content }],
              details: { event, account: acc.email },
            };
          } catch {
            continue;
          }
        }
        return createErrorResult(
          `Event ${params.eventId} not found in any account`,
        );
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-google-calendar-events",
    label: "Search Google Calendar Events",
    description: `Search events in Google Calendar.

Use this to:
- Find events by keyword or content
- Search for specific events
- Filter by date range or attendee
- Discover events quickly`,
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "Search query" })),
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of results (default: 10)" }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { query?: string; maxResults?: number; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["calendar", "search", "--json"];
        if (params.query) {
          args.push(params.query);
        }
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No events found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { events: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-google-calendars",
    label: "List Google Calendars",
    description: `List all calendars in Google Calendar.

Use this to:
- See available calendars
- Get calendar IDs for use with other tools
- Check calendar permissions and access role
- Browse calendar list`,
    parameters: Type.Object({
      maxResults: Type.Optional(
        Type.Number({
          description: "Maximum number of calendars (default: 100)",
        }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { maxResults?: number; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["calendar", "list-calendars", "--json"];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No calendars found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { calendars: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-google-contacts",
    label: "List Google Contacts",
    description: `List all contacts from Google Contacts.

Use this to:
- View all your contacts
- Get contact information
- Find contacts quickly
- Manage your contact list`,
    parameters: Type.Object({
      maxResults: Type.Optional(
        Type.Number({
          description: "Maximum number of contacts (default: 10)",
        }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { maxResults?: number; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["contacts", "list", "--json"];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No contacts found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { contacts: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-google-contact",
    label: "Get Google Contact Details",
    description: `Get detailed information about a specific contact.

Use this to:
- View complete contact information
- See all contact details
- Get contact metadata
- Retrieve specific contact information by ID`,
    parameters: Type.Object({
      resourceName: Type.String({
        description: "Contact resource name (e.g., 'people/contactId')",
      }),
      account: Type.Optional(
        Type.String({
          description:
            "Account email (required if contact is from a specific account)",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { resourceName: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        if (params.account) {
          const contact = await runGogJson<unknown>(
            pi,
            ["contacts", "get", "--json", params.resourceName],
            signal,
            params.account,
          );
          const content = JSON.stringify(
            { ...(contact as object), _account: params.account },
            null,
            2,
          );
          return {
            content: [{ type: "text", text: content }],
            details: { contact, account: params.account },
          };
        }

        // Try all accounts
        const accounts = await getAccounts(pi, signal);
        for (const acc of accounts) {
          try {
            const contact = await runGogJson<unknown>(
              pi,
              ["contacts", "get", "--json", params.resourceName],
              signal,
              acc.email,
            );
            const content = JSON.stringify(
              { ...(contact as object), _account: acc.email },
              null,
              2,
            );
            return {
              content: [{ type: "text", text: content }],
              details: { contact, account: acc.email },
            };
          } catch {
            continue;
          }
        }
        return createErrorResult(
          `Contact ${params.resourceName} not found in any account`,
        );
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-google-contacts",
    label: "Search Google Contacts",
    description: `Search contacts by name, email, or phone number.

Use this to:
- Find contacts by name or email
- Search for phone numbers
- Discover specific contacts quickly
- Filter contacts by criteria`,
    parameters: Type.Object({
      query: Type.String({
        description: "Search query (name, email, or phone)",
      }),
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of results (default: 10)" }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { query: string; maxResults?: number; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["contacts", "search", "--json", params.query];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No contacts found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { contacts: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-google-task-lists",
    label: "List Google Task Lists",
    description: `List all task lists from Google Tasks.

Use this to:
- View all task lists
- Get task list IDs for other operations
- Manage your task organization
- Browse your task structure`,
    parameters: Type.Object({
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of lists (default: 10)" }),
      ),
      account: accountParam,
    }),
    async execute(
      _toolCallId,
      params: { maxResults?: number; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["tasks", "list-lists", "--json"];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const results = await runGogJsonAllAccounts<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const { items, errors } = aggregateArrayResults(
          results as AccountResult<object[]>[],
        );
        const content = formatAggregatedResults(
          items,
          errors,
          "No task lists found",
        );
        return {
          content: [{ type: "text", text: content }],
          details: { lists: items, errors },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-google-tasks",
    label: "List Google Tasks",
    description: `List tasks from a specific task list.

Use this to:
- View all tasks in a list
- Get task IDs for other operations
- Check task status
- Manage your tasks`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of tasks (default: 10)" }),
      ),
      account: Type.String({
        description:
          "Account email (required - task lists are account-specific)",
      }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; maxResults?: number; account: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["tasks", "list", "--json", "--list", params.tasklistId];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const tasks = await runGogJson<unknown[]>(
          pi,
          args,
          signal,
          params.account,
        );
        const items = Array.isArray(tasks)
          ? tasks.map((t) => ({ ...(t as object), _account: params.account }))
          : [];
        const content =
          items.length > 0
            ? items.map((t) => JSON.stringify(t)).join("\n")
            : "No tasks found";
        return {
          content: [{ type: "text", text: content }],
          details: { tasks: items, account: params.account },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "add-google-task",
    label: "Add Google Task",
    description: `Add a new task to a task list.

Use this to:
- Create new tasks
- Set task titles and notes
- Set due dates
- Create subtasks
- Set repeat patterns`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      title: Type.String({ description: "Task title" }),
      notes: Type.Optional(
        Type.String({ description: "Task notes/description" }),
      ),
      due: Type.Optional(
        Type.String({ description: "Due date (RFC3339 or YYYY-MM-DD)" }),
      ),
      account: Type.String({
        description:
          "Account email (required - task lists are account-specific)",
      }),
    }),
    async execute(
      _toolCallId,
      params: {
        tasklistId: string;
        title: string;
        notes?: string;
        due?: string;
        account: string;
      },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = [
          "tasks",
          "add",
          "--json",
          "--list",
          params.tasklistId,
          params.title,
        ];
        if (params.notes) {
          args.push("--notes", params.notes);
        }
        if (params.due) {
          args.push("--due", params.due);
        }
        const task = await runGogJson<unknown>(
          pi,
          args,
          signal,
          params.account,
        );
        const content = JSON.stringify(
          { ...(task as object), _account: params.account },
          null,
          2,
        );
        return {
          content: [{ type: "text", text: `Task created:\n${content}` }],
          details: { task, account: params.account },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "update-google-task",
    label: "Update Google Task",
    description: `Update an existing task.

Use this to:
- Change task title
- Update task notes
- Set or clear due dates
- Change task status
- Modify task details`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      taskId: Type.String({ description: "Task ID" }),
      title: Type.Optional(Type.String({ description: "New task title" })),
      notes: Type.Optional(Type.String({ description: "New task notes" })),
      due: Type.Optional(Type.String({ description: "New due date" })),
      status: Type.Optional(
        Type.String({ description: "New status: needsAction|completed" }),
      ),
      account: Type.String({
        description:
          "Account email (required - task lists are account-specific)",
      }),
    }),
    async execute(
      _toolCallId,
      params: {
        tasklistId: string;
        taskId: string;
        title?: string;
        notes?: string;
        due?: string;
        status?: string;
        account: string;
      },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = [
          "tasks",
          "update",
          "--json",
          "--list",
          params.tasklistId,
          params.taskId,
        ];
        if (params.title !== undefined) {
          args.push("--title", params.title);
        }
        if (params.notes !== undefined) {
          args.push("--notes", params.notes);
        }
        if (params.due !== undefined) {
          args.push("--due", params.due);
        }
        if (params.status) {
          args.push("--status", params.status);
        }
        const task = await runGogJson<unknown>(
          pi,
          args,
          signal,
          params.account,
        );
        const content = JSON.stringify(
          { ...(task as object), _account: params.account },
          null,
          2,
        );
        return {
          content: [{ type: "text", text: `Task updated:\n${content}` }],
          details: { task, account: params.account },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "complete-google-task",
    label: "Complete Google Task",
    description: `Mark a task as completed.

Use this to:
- Mark tasks as done
- Update task status
- Track task completion`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      taskId: Type.String({ description: "Task ID" }),
      account: Type.String({
        description:
          "Account email (required - task lists are account-specific)",
      }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; taskId: string; account: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const task = await runGogJson<unknown>(
          pi,
          [
            "tasks",
            "complete",
            "--json",
            "--list",
            params.tasklistId,
            params.taskId,
          ],
          signal,
          params.account,
        );
        const content = JSON.stringify(
          { ...(task as object), _account: params.account },
          null,
          2,
        );
        return {
          content: [{ type: "text", text: `Task completed:\n${content}` }],
          details: { task, account: params.account },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "uncomplete-google-task",
    label: "Uncomplete Google Task",
    description: `Mark a task as incomplete (needs action).

Use this to:
- Mark tasks as not done
- Update task status back to needsAction
- Reactivate incomplete tasks`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      taskId: Type.String({ description: "Task ID" }),
      account: Type.String({
        description:
          "Account email (required - task lists are account-specific)",
      }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; taskId: string; account: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const task = await runGogJson<unknown>(
          pi,
          [
            "tasks",
            "uncomplete",
            "--json",
            "--list",
            params.tasklistId,
            params.taskId,
          ],
          signal,
          params.account,
        );
        const content = JSON.stringify(
          { ...(task as object), _account: params.account },
          null,
          2,
        );
        return {
          content: [{ type: "text", text: `Task uncompleted:\n${content}` }],
          details: { task, account: params.account },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "delete-google-task",
    label: "Delete Google Task",
    description: `Delete a task from a task list.

Use this to:
- Remove tasks
- Clear completed tasks
- Delete unwanted tasks`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      taskId: Type.String({ description: "Task ID" }),
      account: Type.String({
        description:
          "Account email (required - task lists are account-specific)",
      }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; taskId: string; account: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        await runGogCommand(
          pi,
          ["tasks", "delete", "--list", params.tasklistId, params.taskId],
          signal,
          params.account,
        );
        return {
          content: [
            {
              type: "text",
              text: `Task ${params.taskId} deleted successfully from account ${params.account}`,
            },
          ],
          details: { taskId: params.taskId, account: params.account },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "clear-google-tasks",
    label: "Clear Completed Google Tasks",
    description: `Clear all completed tasks from a task list.

Use this to:
- Clean up completed tasks
- Remove finished items
- Keep task lists organized`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      account: Type.String({
        description:
          "Account email (required - task lists are account-specific)",
      }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; account: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        await runGogCommand(
          pi,
          ["tasks", "clear", "--json", "--list", params.tasklistId],
          signal,
          params.account,
        );
        return {
          content: [
            {
              type: "text",
              text: `Completed tasks cleared from list ${params.tasklistId} (account: ${params.account})`,
            },
          ],
          details: { tasklistId: params.tasklistId, account: params.account },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-google-docs-info",
    label: "Get Google Doc Info",
    description: `Get metadata for a Google Doc.

Use this to:
- View document details
- See document type and size
- Get document links
- Retrieve document information by ID`,
    parameters: Type.Object({
      docId: Type.String({ description: "Google Doc ID" }),
      account: Type.Optional(
        Type.String({
          description: "Account email (if not specified, tries all accounts)",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { docId: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        if (params.account) {
          const info = await runGogJson<unknown>(
            pi,
            ["docs", "info", "--json", params.docId],
            signal,
            params.account,
          );
          const content = JSON.stringify(
            { ...(info as object), _account: params.account },
            null,
            2,
          );
          return {
            content: [{ type: "text", text: content }],
            details: { info, account: params.account },
          };
        }

        // Try all accounts
        const accounts = await getAccounts(pi, signal);
        for (const acc of accounts) {
          try {
            const info = await runGogJson<unknown>(
              pi,
              ["docs", "info", "--json", params.docId],
              signal,
              acc.email,
            );
            const content = JSON.stringify(
              { ...(info as object), _account: acc.email },
              null,
              2,
            );
            return {
              content: [{ type: "text", text: content }],
              details: { info, account: acc.email },
            };
          } catch {
            continue;
          }
        }
        return createErrorResult(
          `Document ${params.docId} not found in any account`,
        );
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "export-google-docs",
    label: "Export Google Doc",
    description: `Export a Google Doc to PDF, DOCX, or TXT format.

Use this to:
- Download documents in various formats
- Get documents as plain text
- Export for offline use
- Convert Google Docs to other formats`,
    parameters: Type.Object({
      docId: Type.String({ description: "Google Doc ID" }),
      format: Type.Optional(
        Type.String({
          description: "Export format (pdf|docx|txt) - default: pdf",
        }),
      ),
      account: Type.Optional(
        Type.String({
          description: "Account email (if not specified, tries all accounts)",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { docId: string; format?: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["docs", "export", "--json", params.docId];
        if (params.format) {
          args.push("--format", params.format);
        }

        if (params.account) {
          const result = await runGogCommand(pi, args, signal, params.account);
          return {
            content: [
              {
                type: "text",
                text:
                  result.stdout ||
                  `Document exported successfully (account: ${params.account})`,
              },
            ],
            details: {
              docId: params.docId,
              format: params.format || "pdf",
              account: params.account,
            },
          };
        }

        // Try all accounts
        const accounts = await getAccounts(pi, signal);
        for (const acc of accounts) {
          try {
            const result = await runGogCommand(pi, args, signal, acc.email);
            return {
              content: [
                {
                  type: "text",
                  text:
                    result.stdout ||
                    `Document exported successfully (account: ${acc.email})`,
                },
              ],
              details: {
                docId: params.docId,
                format: params.format || "pdf",
                account: acc.email,
              },
            };
          } catch {
            continue;
          }
        }
        return createErrorResult(
          `Document ${params.docId} not found in any account`,
        );
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "create-google-docs",
    label: "Create Google Doc",
    description: `Create a new Google Doc.

Use this to:
- Create new documents
- Start with a blank document
- Get document ID and link
- Create documents programmatically`,
    parameters: Type.Object({
      title: Type.String({ description: "Document title" }),
      content: Type.Optional(
        Type.String({ description: "Initial content (optional)" }),
      ),
      account: Type.String({
        description:
          "Account email (required - specify which account to create doc in)",
      }),
    }),
    async execute(
      _toolCallId,
      params: { title: string; content?: string; account: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const args = ["docs", "create", "--json", params.title];
        if (params.content) {
          args.push("--content", params.content);
        }
        const doc = await runGogJson<unknown>(pi, args, signal, params.account);
        const docContent = JSON.stringify(
          { ...(doc as object), _account: params.account },
          null,
          2,
        );
        return {
          content: [{ type: "text", text: `Document created:\n${docContent}` }],
          details: { doc, account: params.account },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "copy-google-docs",
    label: "Copy Google Doc",
    description: `Copy a Google Doc to create a new document.

Use this to:
- Duplicate documents
- Create new versions
- Clone existing content
- Make copies for templates`,
    parameters: Type.Object({
      docId: Type.String({ description: "Source Google Doc ID" }),
      title: Type.String({ description: "New document title" }),
      account: Type.Optional(
        Type.String({
          description: "Account email (if not specified, tries all accounts)",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { docId: string; title: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        if (params.account) {
          const doc = await runGogJson<unknown>(
            pi,
            ["docs", "copy", "--json", params.docId, params.title],
            signal,
            params.account,
          );
          const content = JSON.stringify(
            { ...(doc as object), _account: params.account },
            null,
            2,
          );
          return {
            content: [{ type: "text", text: `Document copied:\n${content}` }],
            details: { doc, account: params.account },
          };
        }

        // Try all accounts
        const accounts = await getAccounts(pi, signal);
        for (const acc of accounts) {
          try {
            const doc = await runGogJson<unknown>(
              pi,
              ["docs", "copy", "--json", params.docId, params.title],
              signal,
              acc.email,
            );
            const content = JSON.stringify(
              { ...(doc as object), _account: acc.email },
              null,
              2,
            );
            return {
              content: [{ type: "text", text: `Document copied:\n${content}` }],
              details: { doc, account: acc.email },
            };
          } catch {
            continue;
          }
        }
        return createErrorResult(
          `Document ${params.docId} not found in any account`,
        );
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "cat-google-docs",
    label: "View Google Doc as Text",
    description: `Print a Google Doc as plain text.

Use this to:
- View document content as plain text
- Get document content programmatically
- Read document content without formatting
- Process document text`,
    parameters: Type.Object({
      docId: Type.String({ description: "Google Doc ID" }),
      account: Type.Optional(
        Type.String({
          description: "Account email (if not specified, tries all accounts)",
        }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { docId: string; account?: string },
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        if (params.account) {
          const result = await runGogCommand(
            pi,
            ["docs", "cat", "--json", params.docId],
            signal,
            params.account,
          );
          return {
            content: [
              {
                type: "text",
                text: `[Account: ${params.account}]\n${result.stdout}`,
              },
            ],
            details: { docId: params.docId, account: params.account },
          };
        }

        // Try all accounts
        const accounts = await getAccounts(pi, signal);
        for (const acc of accounts) {
          try {
            const result = await runGogCommand(
              pi,
              ["docs", "cat", "--json", params.docId],
              signal,
              acc.email,
            );
            return {
              content: [
                {
                  type: "text",
                  text: `[Account: ${acc.email}]\n${result.stdout}`,
                },
              ],
              details: { docId: params.docId, account: acc.email },
            };
          } catch {
            continue;
          }
        }
        return createErrorResult(
          `Document ${params.docId} not found in any account`,
        );
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  // Add a utility tool to list available accounts
  pi.registerTool({
    name: "list-google-accounts",
    label: "List Google Accounts",
    description: `List all authenticated Google accounts.

Use this to:
- See available accounts
- Check which accounts are configured
- Get account emails for other operations`,
    parameters: Type.Object({}),
    async execute(
      _toolCallId,
      _params: Record<string, never>,
      signal: AbortSignal | undefined,
      _onUpdate: AgentToolUpdateCallback | undefined,
      _ctx: ExtensionContext,
    ) {
      try {
        const accounts = await getAccounts(pi, signal);
        if (accounts.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No authenticated accounts found. Run 'gog auth' to authenticate.",
              },
            ],
            details: { accounts: [] },
          };
        }
        const content = accounts
          .map(
            (a) =>
              `${a.email} (client: ${a.client}, scopes: ${a.scopes.join(", ")})`,
          )
          .join("\n");
        return {
          content: [
            { type: "text", text: `Authenticated accounts:\n${content}` },
          ],
          details: { accounts },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });
}
