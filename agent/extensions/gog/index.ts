import type {
  AgentToolResult,
  AgentToolUpdateCallback,
  ExtensionContext,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import type { TextContent } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

// Type definitions for gog command outputs
interface GmailMessage {
  id: string;
  date: string;
  from: string;
  subject: string;
  labels: string[];
  messageCount?: number;
}

interface GmailSearchResponse {
  nextPageToken?: string;
  threads: GmailMessage[];
}

interface GmailMessageDetail {
  id: string;
  threadId?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  snippet?: string;
  internalDate?: string;
  labels?: string[];
  messages?: GmailMessageDetail[];
}

// interface GmailListMessagesResponse {
//   nextPageToken?: string;
//   messages: GmailMessageDetail[];
// }

interface CalendarEvent {
  eventType?: string;
  summary?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
  reminders?: {
    overrides?: Array<{
      method?: string;
      minutes?: number;
    }>;
  };
  visibility?: string;
  transparency?: string;
  organizer?: {
    displayName?: string;
  };
}

interface CalendarEventsResponse {
  events: CalendarEvent[];
  nextPageToken?: string;
}

interface CalendarSearchResponse {
  events: CalendarEvent[];
  nextPageToken?: string;
}

interface CalendarCalendar {
  accessRole?: string;
  backgroundColor?: string;
  colorId?: string;
  conferenceProperties?: {
    allowedConferenceSolutionTypes?: string[];
  };
  defaultReminders?: Array<{
    method?: string;
    minutes?: number;
  }>;
  etag?: string;
  foregroundColor?: string;
  id: string;
  kind?: string;
  selected?: boolean;
  summary?: string;
  summaryOverride?: string;
  timeZone?: string;
  primary?: boolean;
  dataOwner?: string;
  notificationSettings?: {
    notifications?: Array<{
      method?: string;
      type?: string;
    }>;
  };
}

interface CalendarCalendarsResponse {
  calendars: CalendarCalendar[];
  nextPageToken?: string;
}

interface Contact {
  resource?: string;
  name?: string;
  phone?: string;
  email?: string;
}

interface ContactsListResponse {
  contacts?: Contact[];
  nextPageToken?: string;
}

interface ContactsSearchResponse {
  contacts?: Contact[];
  nextPageToken?: string;
}

interface KeepNote {
  id: string;
  title?: string;
  text?: string;
  tags?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  creationTime?: string;
  updateTime?: string;
}

interface KeepListResponse {
  notes?: KeepNote[];
  nextPageToken?: string;
}

interface DocsInfoResponse {
  id?: string;
  title?: string;
  mimeType?: string;
  webViewLink?: string;
  contentLink?: string;
  localizedName?: string;
  embedUrl?: string;
  lastModifiedTimestamp?: string;
  exportLinks?: Record<string, string>;
}

interface DocsExportResponse {
  content?: string;
  mimeType?: string;
}

interface DocsCreateResponse {
  id?: string;
  title?: string;
  webViewLink?: string;
  localizedName?: string;
  exportLinks?: Record<string, string>;
}

interface DocsCopyResponse {
  id?: string;
  title?: string;
  webViewLink?: string;
  localizedName?: string;
  exportLinks?: Record<string, string>;
}

interface DocsCatResponse {
  content?: string;
  mimeType?: string;
}

interface Task {
  id: string;
  title?: string;
  notes?: string;
  dueDate?: string;
  completedDate?: string;
  status?: string;
  listId?: string;
}

interface TaskList {
  id: string;
  title?: string;
}

interface TasksListResponse {
  taskLists?: TaskList[];
}

// Parameter schemas
const ListDriveFilesParams = Type.Object({
  parentId: Type.Optional(
    Type.String({ description: "Parent folder ID (default: root)" }),
  ),
});

const GetDriveFileParams = Type.Object({
  fileId: Type.String({ description: "Google Drive file ID" }),
});

const SearchDriveFilesParams = Type.Object({
  query: Type.String({ description: "Search query" }),
  maxResults: Type.Optional(
    Type.Number({ description: "Maximum number of results (default: 10)" }),
  ),
});

const SearchGmailMessagesParams = Type.Object({
  query: Type.Optional(
    Type.String({
      description:
        "Gmail search query (e.g., 'is:unread', 'from:me', 'subject:meeting')",
    }),
  ),
  maxResults: Type.Optional(
    Type.Number({ description: "Maximum number of results (default: 10)" }),
  ),
});

const GetGmailMessageParams = Type.Object({
  messageId: Type.String({ description: "Gmail message ID" }),
});

const ListCalendarEventsParams = Type.Object({
  calendarId: Type.Optional(
    Type.String({ description: "Calendar ID (default: primary)" }),
  ),
  maxResults: Type.Optional(
    Type.Number({ description: "Maximum number of events (default: 10)" }),
  ),
});

const GetCalendarEventParams = Type.Object({
  calendarId: Type.String({ description: "Calendar ID" }),
  eventId: Type.String({ description: "Event ID" }),
});

const SearchCalendarEventsParams = Type.Object({
  query: Type.Optional(Type.String({ description: "Search query" })),
  maxResults: Type.Optional(
    Type.Number({ description: "Maximum number of results (default: 10)" }),
  ),
});

const ListDriveCalendarsParams = Type.Object({
  maxResults: Type.Optional(
    Type.Number({ description: "Maximum number of calendars (default: 100)" }),
  ),
});

type ListDriveFilesParamsType = Static<typeof ListDriveFilesParams>;
type GetDriveFileParamsType = Static<typeof GetDriveFileParams>;
type SearchDriveFilesParamsType = Static<typeof SearchDriveFilesParams>;
type SearchGmailMessagesParamsType = Static<typeof SearchGmailMessagesParams>;
type GetGmailMessageParamsType = Static<typeof GetGmailMessageParams>;
type ListCalendarEventsParamsType = Static<typeof ListCalendarEventsParams>;
type GetCalendarEventParamsType = Static<typeof GetCalendarEventParams>;
type SearchCalendarEventsParamsType = Static<typeof SearchCalendarEventsParams>;
type ListDriveCalendarsParamsType = Static<typeof ListDriveCalendarsParams>;

function textResult(
  text: string,
  details: Record<string, unknown> = {},
): AgentToolResult<Record<string, unknown>> {
  const content: TextContent[] = [{ type: "text", text }];
  return { content, details };
}

export default function (pi: ExtensionAPI) {
  // List Google Drive Files
  pi.registerTool({
    name: "list-google-drive-files",
    label: "List Google Drive Files",
    description: `List files in Google Drive (root or specific folder).

Use this to:
- Browse Google Drive file structure
- List files in a folder
- Get folder contents
- See file metadata`,
    parameters: ListDriveFilesParams,

    async execute(
      _toolCallId: string,
      params: ListDriveFilesParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { parentId = "root" } = params;

      const command = `gog drive ls --parent ${parentId}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No files found in folder.", {
            parentId,
            count: 0,
          });
        }

        return textResult(output, { parentId });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { parentId },
        };
      }
    },
  });

  // Get Google Drive File Details
  pi.registerTool({
    name: "get-google-drive-file",
    label: "Get Google Drive File Details",
    description: `Get detailed information about a specific Google Drive file.

Use this to:
- Get file metadata
- See file size, MIME type, permissions
- Check file properties
- Retrieve file information by ID`,
    parameters: GetDriveFileParams,

    async execute(
      _toolCallId: string,
      params: GetDriveFileParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { fileId } = params;

      const command = `gog drive get ${fileId}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: `File ${fileId} not found.`,
              },
            ],
            details: { fileId, success: false },
          };
        }

        return textResult(output, { fileId, success: true });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { fileId },
        };
      }
    },
  });

  // Search Google Drive Files
  pi.registerTool({
    name: "search-google-drive-files",
    label: "Search Google Drive Files",
    description: `Full-text search across Google Drive.

Use this to:
- Find files by name or content
- Search across all Drive files
- Filter by file type or metadata
- Discover specific files quickly`,
    parameters: SearchDriveFilesParams,

    async execute(
      _toolCallId: string,
      params: SearchDriveFilesParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { query, maxResults = 10 } = params;

      const command = `gog drive search "${query}" --max ${maxResults}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No files found matching query.", {
            query,
            maxResults,
            count: 0,
          });
        }

        return textResult(output, { query, maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { query, maxResults },
        };
      }
    },
  });

  // Search Gmail Messages
  pi.registerTool({
    name: "search-google-gmail-messages",
    label: "Search Gmail Messages",
    description: `Search Gmail threads using Gmail query syntax.

Use this to:
- Find emails by subject, sender, or content
- Search unread messages
- Filter by labels or date
- Find specific emails quickly`,
    parameters: SearchGmailMessagesParams,

    async execute(
      _toolCallId: string,
      params: SearchGmailMessagesParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { query, maxResults = 10 } = params;

      const command = `gog gmail search "${query}" --max ${maxResults}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No messages found matching query.", {
            query,
            maxResults,
            count: 0,
          });
        }

        return textResult(output, { query, maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { query, maxResults },
        };
      }
    },
  });

  // Get Gmail Message Details
  pi.registerTool({
    name: "get-google-gmail-message",
    label: "Get Gmail Message Details",
    description: `Get full details of a specific Gmail message.

Use this to:
- View complete message content
- See message headers and metadata
- Read message body
- Get message information by ID`,
    parameters: GetGmailMessageParams,

    async execute(
      _toolCallId: string,
      params: GetGmailMessageParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { messageId } = params;

      const command = `gog gmail get ${messageId}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(output || `Message ${messageId} not found.`, {
          messageId,
          success: true,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { messageId },
        };
      }
    },
  });

  // List Calendar Events
  pi.registerTool({
    name: "list-google-calendar-events",
    label: "List Calendar Events",
    description: `List events from a calendar.

Use this to:
- View calendar events
- Get event details
- See upcoming events
- Check calendar contents`,
    parameters: ListCalendarEventsParams,

    async execute(
      _toolCallId: string,
      params: ListCalendarEventsParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { calendarId = "primary", maxResults = 10 } = params;

      const command = `gog calendar events`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No events found in calendar.", {
            calendarId,
            maxResults,
            count: 0,
          });
        }

        return textResult(output, { calendarId, maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { calendarId, maxResults },
        };
      }
    },
  });

  // Get Calendar Event Details
  pi.registerTool({
    name: "get-google-calendar-event",
    label: "Get Calendar Event Details",
    description: `Get details of a specific calendar event.

Use this to:
- View complete event information
- See event start/end times
- Get event attendees and location
- Retrieve event metadata by ID`,
    parameters: GetCalendarEventParams,

    async execute(
      _toolCallId: string,
      params: GetCalendarEventParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { calendarId, eventId } = params;

      const command = `gog calendar event ${calendarId} ${eventId}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(
          output || `Event ${eventId} not found in calendar ${calendarId}.`,
          { calendarId, eventId, success: true },
        );
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { calendarId, eventId },
        };
      }
    },
  });

  // Search Calendar Events
  pi.registerTool({
    name: "search-google-calendar-events",
    label: "Search Calendar Events",
    description: `Search events in Google Calendar.

Use this to:
- Find events by keyword or content
- Search for specific events
- Filter by date range or attendee
- Discover events quickly`,
    parameters: SearchCalendarEventsParams,

    async execute(
      _toolCallId: string,
      params: SearchCalendarEventsParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { query, maxResults = 10 } = params;

      const command = `gog calendar search "${query}"`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No events found matching query.", {
            query,
            maxResults,
            count: 0,
          });
        }

        return textResult(output, { query, maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { query, maxResults },
        };
      }
    },
  });

  // List Google Calendars
  pi.registerTool({
    name: "list-google-calendars",
    label: "List Google Calendars",
    description: `List all calendars in Google Calendar.

Use this to:
- See available calendars
- Get calendar IDs for use with other tools
- Check calendar permissions and access role
- Browse calendar list`,
    parameters: ListDriveCalendarsParams,

    async execute(
      _toolCallId: string,
      params: ListDriveCalendarsParamsType,
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { maxResults = 100 } = params;

      const command = `gog calendar calendars`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No calendars found.", { maxResults, count: 0 });
        }

        return textResult(output, { maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { maxResults },
        };
      }
    },
  });

  // List Contacts
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
    }),

    async execute(
      _toolCallId: string,
      params: { maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { maxResults = 10 } = params;

      const command = `gog contacts list --max ${maxResults}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No contacts found.", { maxResults, count: 0 });
        }

        return textResult(output, { maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { maxResults },
        };
      }
    },
  });

  // Get Contact Details
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
    }),

    async execute(
      _toolCallId: string,
      params: { resourceName: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { resourceName } = params;

      const command = `gog contacts get "${resourceName}"`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: `Contact ${resourceName} not found.`,
              },
            ],
            details: { resourceName, success: false },
          };
        }

        return textResult(output, { resourceName, success: true });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { resourceName },
        };
      }
    },
  });

  // Search Contacts
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
    }),

    async execute(
      _toolCallId: string,
      params: { query: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { query, maxResults = 10 } = params;

      const command = `gog contacts search "${query}" --max ${maxResults}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No contacts found matching query.", {
            query,
            maxResults,
            count: 0,
          });
        }

        return textResult(output, { query, maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { query, maxResults },
        };
      }
    },
  });

  // List Task Lists
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
    }),

    async execute(
      _toolCallId: string,
      params: { maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { maxResults = 10 } = params;

      const command = `gog tasks lists --max ${maxResults}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No task lists found.", { maxResults, count: 0 });
        }

        return textResult(output, { maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { maxResults },
        };
      }
    },
  });

  // List Tasks
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
      tasklistId: Type.String({
        description: "Task list ID (default: 'default')",
      }),
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of tasks (default: 10)" }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: { tasklistId: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { tasklistId = "default", maxResults = 10 } = params;

      const command = `gog tasks list "${tasklistId}" --max ${maxResults}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No tasks found in task list.", {
            tasklistId,
            maxResults,
            count: 0,
          });
        }

        return textResult(output, { tasklistId, maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { tasklistId, maxResults },
        };
      }
    },
  });

  // List Keep Notes
  pi.registerTool({
    name: "list-google-keep-notes",
    label: "List Google Keep Notes",
    description: `List all notes from Google Keep.

Use this to:
- View all your Keep notes
- Get note IDs for other operations
- Browse your notes
- Manage your note collection`,
    parameters: Type.Object({
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of notes (default: 10)" }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: { maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { maxResults = 10 } = params;

      const command = `gog keep list --max ${maxResults}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No notes found.", { maxResults, count: 0 });
        }

        return textResult(output, { maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { maxResults },
        };
      }
    },
  });

  // Search Keep Notes
  pi.registerTool({
    name: "search-google-keep-notes",
    label: "Search Google Keep Notes",
    description: `Search Keep notes by text.

Use this to:
- Find notes by content
- Search through your notes
- Discover specific information
- Filter notes by criteria`,
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      maxResults: Type.Optional(
        Type.Number({ description: "Maximum number of results (default: 10)" }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: { query: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { query, maxResults = 10 } = params;

      const command = `gog keep search "${query}" --max ${maxResults}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return textResult("No notes found matching query.", {
            query,
            maxResults,
            count: 0,
          });
        }

        return textResult(output, { query, maxResults });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { query, maxResults },
        };
      }
    },
  });

  // Get Docs Info
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
    }),

    async execute(
      _toolCallId: string,
      params: { docId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { docId } = params;

      const command = `gog docs info ${docId}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: `Doc ${docId} not found.`,
              },
            ],
            details: { docId, success: false },
          };
        }

        return textResult(output, { docId, success: true });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { docId },
        };
      }
    },
  });

  // Export Docs
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
    }),

    async execute(
      _toolCallId: string,
      params: { docId: string; format?: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { docId, format = "pdf" } = params;

      const command = `gog docs export ${docId} --format ${format}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: `Export failed for doc ${docId}.`,
              },
            ],
            details: { docId, format, success: false },
          };
        }

        return textResult(output, { docId, format, success: true });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { docId, format },
        };
      }
    },
  });

  // Create Docs
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
    }),

    async execute(
      _toolCallId: string,
      params: { title: string; content?: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { title, content } = params;

      let command = `gog docs create "${title}"`;

      if (content) {
        command += ` --content "${content}"`;
      }

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to create doc "${title}".`,
              },
            ],
            details: { title, success: false },
          };
        }

        return textResult(output, { title, success: true });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { title },
        };
      }
    },
  });

  // Copy Docs
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
    }),

    async execute(
      _toolCallId: string,
      params: { docId: string; title: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { docId, title } = params;

      const command = `gog docs copy ${docId} "${title}"`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to copy doc "${docId}" to "${title}".`,
              },
            ],
            details: { docId, title, success: false },
          };
        }

        return textResult(output, { docId, title, success: true });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { docId, title },
        };
      }
    },
  });

  // Cat Docs (View as text)
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
    }),

    async execute(
      _toolCallId: string,
      params: { docId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { docId } = params;

      const command = `gog docs cat ${docId}`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to read doc "${docId}".`,
              },
            ],
            details: { docId, success: false },
          };
        }

        return textResult(output, { docId, success: true });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { docId },
        };
      }
    },
  });

  // Add Task
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
      tasklistId: Type.String({
        description: "Task list ID",
      }),
      title: Type.String({
        description: "Task title (required)",
      }),
      notes: Type.Optional(
        Type.String({
          description: "Task notes/description",
        }),
      ),
      due: Type.Optional(
        Type.String({
          description: "Due date (RFC3339 or YYYY-MM-DD)",
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: {
        tasklistId: string;
        title: string;
        notes?: string;
        due?: string;
      },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { tasklistId, title, notes, due } = params;

      let command = `gog tasks add "${tasklistId}" --title "${title}"`;

      if (notes) {
        command += ` --notes "${notes}"`;
      }
      if (due) {
        command += ` --due "${due}"`;
      }

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(output || `Task "${title}" added successfully.`, {
          tasklistId,
          title,
          notes,
          due,
          success: true,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { tasklistId, title, notes, due },
        };
      }
    },
  });

  // Update Task
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
      tasklistId: Type.String({
        description: "Task list ID",
      }),
      taskId: Type.String({
        description: "Task ID",
      }),
      title: Type.Optional(
        Type.String({
          description: "New task title (set empty to clear)",
        }),
      ),
      notes: Type.Optional(
        Type.String({
          description: "New task notes (set empty to clear)",
        }),
      ),
      due: Type.Optional(
        Type.String({
          description: "New due date (set empty to clear)",
        }),
      ),
      status: Type.Optional(
        Type.String({
          description: "New status: needsAction|completed",
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: {
        tasklistId: string;
        taskId: string;
        title?: string;
        notes?: string;
        due?: string;
        status?: string;
      },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { tasklistId, taskId, title, notes, due, status } = params;

      let command = `gog tasks update "${tasklistId}" "${taskId}"`;

      if (title) {
        command += ` --title "${title}"`;
      }
      if (notes) {
        command += ` --notes "${notes}"`;
      }
      if (due) {
        command += ` --due "${due}"`;
      }
      if (status) {
        command += ` --status "${status}"`;
      }

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(output || `Task ${taskId} updated successfully.`, {
          tasklistId,
          taskId,
          title,
          notes,
          due,
          status,
          success: true,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { tasklistId, taskId, title, notes, due, status },
        };
      }
    },
  });

  // Complete Task
  pi.registerTool({
    name: "complete-google-task",
    label: "Complete Google Task",
    description: `Mark a task as completed.

Use this to:
- Mark tasks as done
- Update task status
- Track task completion`,
    parameters: Type.Object({
      tasklistId: Type.String({
        description: "Task list ID",
      }),
      taskId: Type.String({
        description: "Task ID",
      }),
    }),

    async execute(
      _toolCallId: string,
      params: { tasklistId: string; taskId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { tasklistId, taskId } = params;

      const command = `gog tasks done "${tasklistId}" "${taskId}"`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(output || `Task ${taskId} marked as completed.`, {
          tasklistId,
          taskId,
          success: true,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { tasklistId, taskId },
        };
      }
    },
  });

  // Uncomplete Task
  pi.registerTool({
    name: "uncomplete-google-task",
    label: "Uncomplete Google Task",
    description: `Mark a task as incomplete (needs action).

Use this to:
- Mark tasks as not done
- Update task status back to needsAction
- Reactivate incomplete tasks`,
    parameters: Type.Object({
      tasklistId: Type.String({
        description: "Task list ID",
      }),
      taskId: Type.String({
        description: "Task ID",
      }),
    }),

    async execute(
      _toolCallId: string,
      params: { tasklistId: string; taskId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { tasklistId, taskId } = params;

      const command = `gog tasks undo "${tasklistId}" "${taskId}"`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(output || `Task ${taskId} marked as incomplete.`, {
          tasklistId,
          taskId,
          success: true,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { tasklistId, taskId },
        };
      }
    },
  });

  // Delete Task
  pi.registerTool({
    name: "delete-google-task",
    label: "Delete Google Task",
    description: `Delete a task from a task list.

Use this to:
- Remove tasks
- Clear completed tasks
- Delete unwanted tasks`,
    parameters: Type.Object({
      tasklistId: Type.String({
        description: "Task list ID",
      }),
      taskId: Type.String({
        description: "Task ID",
      }),
    }),

    async execute(
      _toolCallId: string,
      params: { tasklistId: string; taskId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { tasklistId, taskId } = params;

      const command = `gog tasks delete "${tasklistId}" "${taskId}"`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(output || `Task ${taskId} deleted successfully.`, {
          tasklistId,
          taskId,
          success: true,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { tasklistId, taskId },
        };
      }
    },
  });

  // Clear Completed Tasks
  pi.registerTool({
    name: "clear-google-tasks",
    label: "Clear Completed Tasks",
    description: `Clear all completed tasks from a task list.

Use this to:
- Clean up completed tasks
- Remove finished items
- Keep task lists organized`,
    parameters: Type.Object({
      tasklistId: Type.String({
        description: "Task list ID",
      }),
    }),

    async execute(
      _toolCallId: string,
      params: { tasklistId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { tasklistId } = params;

      const command = `gog tasks clear "${tasklistId}"`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(
          output || `Completed tasks cleared from "${tasklistId}".`,
          {
            tasklistId,
            success: true,
          },
        );
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { tasklistId },
        };
      }
    },
  });

  // Get Keep Note
  pi.registerTool({
    name: "get-google-keep-note",
    label: "Get Google Keep Note",
    description: `Get a note from Google Keep.

Use this to:
- View note content
- Get note details
- Read note information
- Retrieve specific note by ID`,
    parameters: Type.Object({
      noteId: Type.String({
        description: "Note ID or name (e.g., notes/abc123)",
      }),
    }),

    async execute(
      _toolCallId: string,
      params: { noteId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { noteId } = params;

      const command = `gog keep get "${noteId}"`;

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        if (!output || !output.trim()) {
          return {
            content: [
              {
                type: "text",
                text: `Note ${noteId} not found.`,
              },
            ],
            details: { noteId, success: false },
          };
        }

        return textResult(output, { noteId, success: true });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { noteId },
        };
      }
    },
  });

  // Keep Attachment
  pi.registerTool({
    name: "download-google-keep-attachment",
    label: "Download Keep Attachment",
    description: `Download an attachment from a Keep note.

Use this to:
- Download note attachments
- Get file content
- Retrieve attachment data
- Save attachments locally`,
    parameters: Type.Object({
      attachmentName: Type.String({
        description: "Attachment name (e.g., notes/abc123/attachments/xyz789)",
      }),
      mimeType: Type.Optional(
        Type.String({
          description: "MIME type of attachment (e.g., image/jpeg)",
        }),
      ),
      out: Type.Optional(
        Type.String({
          description: "Output file path (optional)",
        }),
      ),
    }),

    async execute(
      _toolCallId: string,
      params: {
        attachmentName: string;
        mimeType?: string;
        out?: string;
      },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal: AbortSignal,
    ) {
      const { attachmentName, mimeType, out } = params;

      let command = `gog keep attachment "${attachmentName}"`;

      if (mimeType) {
        command += ` --mime-type "${mimeType}"`;
      }
      if (out) {
        command += ` --out "${out}"`;
      }

      try {
        const { execSync } = await import("child_process");
        const output = execSync(command, { encoding: "utf-8", stdio: "pipe" });

        return textResult(output || `Attachment downloaded successfully.`, {
          attachmentName,
          mimeType,
          out,
          success: true,
        });
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          details: { attachmentName, mimeType, out },
        };
      }
    },
  });
}
