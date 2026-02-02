import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolUpdateCallback,
  AgentToolResult,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type GogToolResult<T = unknown> = AgentToolResult<T>;

interface GogError {
  error: string;
}

function createErrorResult(message: string): GogToolResult<GogError> {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    details: { error: message },
  };
}

async function runGogCommand(
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(`gog ${args.join(" ")}`, {
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof Error) {
      const execError = error as { stdout?: string; stderr?: string };
      throw new Error(
        execError.stderr ||
          execError.stdout ||
          error.message ||
          "Unknown error executing gog command",
      );
    }
    throw new Error("Unknown error executing gog command");
  }
}

async function runGogJson<T>(args: string[]): Promise<T> {
  const { stdout } = await runGogCommand(args);
  try {
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON output: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export default function gogExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "list-drive-files",
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
    }),
    async execute(
      _toolCallId,
      params: { parentId?: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["drive", "ls", "--json"];
        if (params.parentId) {
          args.push("--parent", params.parentId);
        }
        const files = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(files) && files.length > 0
            ? files.map((f) => JSON.stringify(f)).join("\n")
            : "No files found";
        return {
          content: [{ type: "text", text: content }],
          details: { files },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-drive-file",
    label: "Get Google Drive File Details",
    description: `Get detailed information about a specific Google Drive file.

Use this to:
- Get file metadata
- See file size, MIME type, permissions
- Check file properties
- Retrieve file information by ID`,
    parameters: Type.Object({
      fileId: Type.String({ description: "Google Drive file ID" }),
    }),
    async execute(
      _toolCallId,
      params: { fileId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const file = await runGogJson<unknown>([
          "drive",
          "get",
          "--json",
          params.fileId,
        ]);
        const content = JSON.stringify(file, null, 2);
        return {
          content: [{ type: "text", text: content }],
          details: { file },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-drive-files",
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
    }),
    async execute(
      _toolCallId,
      params: { query: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["drive", "search", "--json", params.query];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const files = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(files) && files.length > 0
            ? files.map((f) => JSON.stringify(f)).join("\n")
            : "No files found";
        return {
          content: [{ type: "text", text: content }],
          details: { files },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-gmail-messages",
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
    }),
    async execute(
      _toolCallId,
      params: { query?: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["gmail", "search", "--json"];
        if (params.query) {
          args.push(params.query);
        }
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const messages = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(messages) && messages.length > 0
            ? messages.map((m) => JSON.stringify(m)).join("\n")
            : "No messages found";
        return {
          content: [{ type: "text", text: content }],
          details: { messages },
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
    }),
    async execute(
      _toolCallId,
      params: { messageId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const message = await runGogJson<unknown>([
          "gmail",
          "get",
          "--json",
          params.messageId,
        ]);
        const content = JSON.stringify(message, null, 2);
        return {
          content: [{ type: "text", text: content }],
          details: { message },
        };
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
    }),
    async execute(
      _toolCallId,
      params: { calendarId?: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["calendar", "list", "--json"];
        if (params.calendarId) {
          args.push("--calendar", params.calendarId);
        }
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const events = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(events) && events.length > 0
            ? events.map((e) => JSON.stringify(e)).join("\n")
            : "No events found";
        return {
          content: [{ type: "text", text: content }],
          details: { events },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-calendar-event",
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
    }),
    async execute(
      _toolCallId,
      params: { calendarId: string; eventId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const event = await runGogJson<unknown>([
          "calendar",
          "get",
          "--json",
          "--calendar",
          params.calendarId,
          params.eventId,
        ]);
        const content = JSON.stringify(event, null, 2);
        return {
          content: [{ type: "text", text: content }],
          details: { event },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-calendar-events",
    label: "Search Calendar Events",
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
    }),
    async execute(
      _toolCallId,
      params: { query?: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["calendar", "search", "--json"];
        if (params.query) {
          args.push(params.query);
        }
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const events = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(events) && events.length > 0
            ? events.map((e) => JSON.stringify(e)).join("\n")
            : "No events found";
        return {
          content: [{ type: "text", text: content }],
          details: { events },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-calendars",
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
    }),
    async execute(
      _toolCallId,
      params: { maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["calendar", "list-calendars", "--json"];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const calendars = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(calendars) && calendars.length > 0
            ? calendars.map((c) => JSON.stringify(c)).join("\n")
            : "No calendars found";
        return {
          content: [{ type: "text", text: content }],
          details: { calendars },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-contacts",
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
      _toolCallId,
      params: { maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["contacts", "list", "--json"];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const contacts = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(contacts) && contacts.length > 0
            ? contacts.map((c) => JSON.stringify(c)).join("\n")
            : "No contacts found";
        return {
          content: [{ type: "text", text: content }],
          details: { contacts },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-contact",
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
      _toolCallId,
      params: { resourceName: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const contact = await runGogJson<unknown>([
          "contacts",
          "get",
          "--json",
          params.resourceName,
        ]);
        const content = JSON.stringify(contact, null, 2);
        return {
          content: [{ type: "text", text: content }],
          details: { contact },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-contacts",
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
      _toolCallId,
      params: { query: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["contacts", "search", "--json", params.query];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const contacts = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(contacts) && contacts.length > 0
            ? contacts.map((c) => JSON.stringify(c)).join("\n")
            : "No contacts found";
        return {
          content: [{ type: "text", text: content }],
          details: { contacts },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-task-lists",
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
      _toolCallId,
      params: { maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["tasks", "list-lists", "--json"];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const lists = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(lists) && lists.length > 0
            ? lists.map((l) => JSON.stringify(l)).join("\n")
            : "No task lists found";
        return {
          content: [{ type: "text", text: content }],
          details: { lists },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-tasks",
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
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["tasks", "list", "--json", "--list", params.tasklistId];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const tasks = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(tasks) && tasks.length > 0
            ? tasks.map((t) => JSON.stringify(t)).join("\n")
            : "No tasks found";
        return {
          content: [{ type: "text", text: content }],
          details: { tasks },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "add-task",
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
    }),
    async execute(
      _toolCallId,
      params: {
        tasklistId: string;
        title: string;
        notes?: string;
        due?: string;
      },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
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
        const task = await runGogJson<unknown>(args);
        const content = JSON.stringify(task, null, 2);
        return {
          content: [{ type: "text", text: `Task created:\n${content}` }],
          details: { task },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "update-task",
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
      },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
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
        const task = await runGogJson<unknown>(args);
        const content = JSON.stringify(task, null, 2);
        return {
          content: [{ type: "text", text: `Task updated:\n${content}` }],
          details: { task },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "complete-task",
    label: "Complete Google Task",
    description: `Mark a task as completed.

Use this to:
- Mark tasks as done
- Update task status
- Track task completion`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      taskId: Type.String({ description: "Task ID" }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; taskId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const task = await runGogJson<unknown>([
          "tasks",
          "complete",
          "--json",
          "--list",
          params.tasklistId,
          params.taskId,
        ]);
        const content = JSON.stringify(task, null, 2);
        return {
          content: [{ type: "text", text: `Task completed:\n${content}` }],
          details: { task },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "uncomplete-task",
    label: "Uncomplete Google Task",
    description: `Mark a task as incomplete (needs action).

Use this to:
- Mark tasks as not done
- Update task status back to needsAction
- Reactivate incomplete tasks`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      taskId: Type.String({ description: "Task ID" }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; taskId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const task = await runGogJson<unknown>([
          "tasks",
          "uncomplete",
          "--json",
          "--list",
          params.tasklistId,
          params.taskId,
        ]);
        const content = JSON.stringify(task, null, 2);
        return {
          content: [{ type: "text", text: `Task uncompleted:\n${content}` }],
          details: { task },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "delete-task",
    label: "Delete Google Task",
    description: `Delete a task from a task list.

Use this to:
- Remove tasks
- Clear completed tasks
- Delete unwanted tasks`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
      taskId: Type.String({ description: "Task ID" }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string; taskId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        await runGogCommand([
          "tasks",
          "delete",
          "--list",
          params.tasklistId,
          params.taskId,
        ]);
        return {
          content: [
            {
              type: "text",
              text: `Task ${params.taskId} deleted successfully`,
            },
          ],
          details: { taskId: params.taskId },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "clear-tasks",
    label: "Clear Completed Tasks",
    description: `Clear all completed tasks from a task list.

Use this to:
- Clean up completed tasks
- Remove finished items
- Keep task lists organized`,
    parameters: Type.Object({
      tasklistId: Type.String({ description: "Task list ID" }),
    }),
    async execute(
      _toolCallId,
      params: { tasklistId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        await runGogCommand([
          "tasks",
          "clear",
          "--json",
          "--list",
          params.tasklistId,
        ]);
        return {
          content: [
            {
              type: "text",
              text: `Completed tasks cleared from list ${params.tasklistId}`,
            },
          ],
          details: { tasklistId: params.tasklistId },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "list-keep-notes",
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
      _toolCallId,
      params: { maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["keep", "list", "--json"];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const notes = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(notes) && notes.length > 0
            ? notes.map((n) => JSON.stringify(n)).join("\n")
            : "No notes found";
        return {
          content: [{ type: "text", text: content }],
          details: { notes },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "search-keep-notes",
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
      _toolCallId,
      params: { query: string; maxResults?: number },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["keep", "search", "--json", params.query];
        if (params.maxResults) {
          args.push("--max-results", String(params.maxResults));
        }
        const notes = await runGogJson<unknown[]>(args);
        const content =
          Array.isArray(notes) && notes.length > 0
            ? notes.map((n) => JSON.stringify(n)).join("\n")
            : "No notes found";
        return {
          content: [{ type: "text", text: content }],
          details: { notes },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-keep-note",
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
      _toolCallId,
      params: { noteId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const note = await runGogJson<unknown>([
          "keep",
          "get",
          "--json",
          params.noteId,
        ]);
        const content = JSON.stringify(note, null, 2);
        return {
          content: [{ type: "text", text: content }],
          details: { note },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "keep-attachment",
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
        Type.String({ description: "Output file path (optional)" }),
      ),
    }),
    async execute(
      _toolCallId,
      params: { attachmentName: string; mimeType?: string; out?: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["keep", "attachment", "--json", params.attachmentName];
        if (params.mimeType) {
          args.push("--mime-type", params.mimeType);
        }
        if (params.out) {
          args.push("--out", params.out);
        }
        await runGogCommand(args);
        return {
          content: [
            {
              type: "text",
              text: `Attachment ${params.attachmentName} downloaded successfully${params.out ? ` to ${params.out}` : ""}`,
            },
          ],
          details: { attachmentName: params.attachmentName },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "get-docs-info",
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
      _toolCallId,
      params: { docId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const info = await runGogJson<unknown>([
          "docs",
          "info",
          "--json",
          params.docId,
        ]);
        const content = JSON.stringify(info, null, 2);
        return {
          content: [{ type: "text", text: content }],
          details: { info },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "export-docs",
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
      _toolCallId,
      params: { docId: string; format?: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["docs", "export", "--json", params.docId];
        if (params.format) {
          args.push("--format", params.format);
        }
        const result = await runGogCommand(args);
        return {
          content: [
            {
              type: "text",
              text: result.stdout || "Document exported successfully",
            },
          ],
          details: { docId: params.docId, format: params.format || "pdf" },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "create-docs",
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
      _toolCallId,
      params: { title: string; content?: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const args = ["docs", "create", "--json", params.title];
        if (params.content) {
          args.push("--content", params.content);
        }
        const doc = await runGogJson<unknown>(args);
        const docContent = JSON.stringify(doc, null, 2);
        return {
          content: [{ type: "text", text: `Document created:\n${docContent}` }],
          details: { doc },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "copy-docs",
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
      _toolCallId,
      params: { docId: string; title: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const doc = await runGogJson<unknown>([
          "docs",
          "copy",
          "--json",
          params.docId,
          params.title,
        ]);
        const content = JSON.stringify(doc, null, 2);
        return {
          content: [{ type: "text", text: `Document copied:\n${content}` }],
          details: { doc },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });

  pi.registerTool({
    name: "cat-docs",
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
      _toolCallId,
      params: { docId: string },
      _onUpdate: AgentToolUpdateCallback,
      _ctx: ExtensionContext,
      _signal?: AbortSignal,
    ) {
      try {
        const result = await runGogCommand([
          "docs",
          "cat",
          "--json",
          params.docId,
        ]);
        return {
          content: [{ type: "text", text: result.stdout }],
          details: { docId: params.docId },
        };
      } catch (error) {
        return createErrorResult(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  });
}
