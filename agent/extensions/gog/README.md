# Gog Extension

Tools for interacting with the gog Google Workspace tool.

## Installation

Install via Homebrew:

```bash
brew install steipete/tap/gogcli
```

## Tools

### list-drive-files

**Label:** List Google Drive Files

**Description:** List files in Google Drive (root or specific folder).

Use this to:

- Browse Google Drive file structure
- List files in a folder
- Get folder contents
- See file metadata

**Parameters:**

- `parentId` (string, optional): Parent folder ID (default: root)

### get-drive-file

**Label:** Get Google Drive File Details

**Description:** Get detailed information about a specific Google Drive file.

Use this to:

- Get file metadata
- See file size, MIME type, permissions
- Check file properties
- Retrieve file information by ID

**Parameters:**

- `fileId` (string, required): Google Drive file ID

### search-drive-files

**Label:** Search Google Drive Files

**Description:** Full-text search across Google Drive.

Use this to:

- Find files by name or content
- Search across all Drive files
- Filter by file type or metadata
- Discover specific files quickly

**Parameters:**

- `query` (string, required): Search query
- `maxResults` (number, optional): Maximum number of results (default: 10)

### search-gmail-messages

**Label:** Search Gmail Messages

**Description:** Search Gmail threads using Gmail query syntax.

Use this to:

- Find emails by subject, sender, or content
- Search unread messages
- Filter by labels or date
- Find specific emails quickly

**Parameters:**

- `query` (string, optional): Gmail search query (e.g., "is:unread", "from:me", "subject:meeting")
- `maxResults` (number, optional): Maximum number of results (default: 10)

### get-gmail-message

**Label:** Get Gmail Message Details

**Description:** Get full details of a specific Gmail message.

Use this to:

- View complete message content
- See message headers and metadata
- Read message body
- Get message information by ID

**Parameters:**

- `messageId` (string, required): Gmail message ID

### list-calendar-events

**Label:** List Calendar Events

**Description:** List events from a calendar.

Use this to:

- View calendar events
- Get event details
- See upcoming events
- Check calendar contents

**Parameters:**

- `calendarId` (string, optional): Calendar ID (default: primary)
- `maxResults` (number, optional): Maximum number of events (default: 10)

### get-calendar-event

**Label:** Get Calendar Event Details

**Description:** Get details of a specific calendar event.

Use this to:

- View complete event information
- See event start/end times
- Get event attendees and location
- Retrieve event metadata by ID

**Parameters:**

- `calendarId` (string, required): Calendar ID
- `eventId` (string, required): Event ID

### search-calendar-events

**Label:** Search Calendar Events

**Description:** Search events in Google Calendar.

Use this to:

- Find events by keyword or content
- Search for specific events
- Filter by date range or attendee
- Discover events quickly

**Parameters:**

- `query` (string, optional): Search query
- `maxResults` (number, optional): Maximum number of results (default: 10)

### list-drive-calendars

**Label:** List Google Calendars

**Description:** List all calendars in Google Calendar.

Use this to:

- See available calendars
- Get calendar IDs for use with other tools
- Check calendar permissions and access role
- Browse calendar list

**Parameters:**

- `maxResults` (number, optional): Maximum number of calendars (default: 100)

### list-contacts

**Label:** List Google Contacts

**Description:** List all contacts from Google Contacts.

Use this to:

- View all your contacts
- Get contact information
- Find contacts quickly
- Manage your contact list

**Parameters:**

- `maxResults` (number, optional): Maximum number of contacts (default: 10)

### get-contact

**Label:** Get Google Contact Details

**Description:** Get detailed information about a specific contact.

Use this to:

- View complete contact information
- See all contact details
- Get contact metadata
- Retrieve specific contact information by ID

**Parameters:**

- `resourceName` (string, required): Contact resource name (e.g., 'people/contactId')

### search-contacts

**Label:** Search Google Contacts

**Description:** Search contacts by name, email, or phone number.

Use this to:

- Find contacts by name or email
- Search for phone numbers
- Discover specific contacts quickly
- Filter contacts by criteria

**Parameters:**

- `query` (string, required): Search query (name, email, or phone)
- `maxResults` (number, optional): Maximum number of results (default: 10)

### list-task-lists

**Label:** List Google Task Lists

**Description:** List all task lists from Google Tasks.

Use this to:

- View all task lists
- Get task list IDs for other operations
- Manage your task organization
- Browse your task structure

**Parameters:**

- `maxResults` (number, optional): Maximum number of lists (default: 10)

### list-tasks

**Label:** List Google Tasks

**Description:** List tasks from a specific task list.

Use this to:

- View all tasks in a list
- Get task IDs for other operations
- Check task status
- Manage your tasks

**Parameters:**

- `tasklistId` (string, required): Task list ID
- `maxResults` (number, optional): Maximum number of tasks (default: 10)

### add-task

**Label:** Add Google Task

**Description:** Add a new task to a task list.

Use this to:

- Create new tasks
- Set task titles and notes
- Set due dates
- Create subtasks
- Set repeat patterns

**Parameters:**

- `tasklistId` (string, required): Task list ID
- `title` (string, required): Task title
- `notes` (string, optional): Task notes/description
- `due` (string, optional): Due date (RFC3339 or YYYY-MM-DD)

### update-task

**Label:** Update Google Task

**Description:** Update an existing task.

Use this to:

- Change task title
- Update task notes
- Set or clear due dates
- Change task status
- Modify task details

**Parameters:**

- `tasklistId` (string, required): Task list ID
- `taskId` (string, required): Task ID
- `title` (string, optional): New task title (set empty to clear)
- `notes` (string, optional): New task notes (set empty to clear)
- `due` (string, optional): New due date (set empty to clear)
- `status` (string, optional): New status: needsAction|completed

### complete-task

**Label:** Complete Google Task

**Description:** Mark a task as completed.

Use this to:

- Mark tasks as done
- Update task status
- Track task completion

**Parameters:**

- `tasklistId` (string, required): Task list ID
- `taskId` (string, required): Task ID

### uncomplete-task

**Label:** Uncomplete Google Task

**Description:** Mark a task as incomplete (needs action).

Use this to:

- Mark tasks as not done
- Update task status back to needsAction
- Reactivate incomplete tasks

**Parameters:**

- `tasklistId` (string, required): Task list ID
- `taskId` (string, required): Task ID

### delete-task

**Label:** Delete Google Task

**Description:** Delete a task from a task list.

Use this to:

- Remove tasks
- Clear completed tasks
- Delete unwanted tasks

**Parameters:**

- `tasklistId` (string, required): Task list ID
- `taskId` (string, required): Task ID

### clear-tasks

**Label:** Clear Completed Tasks

**Description:** Clear all completed tasks from a task list.

Use this to:

- Clean up completed tasks
- Remove finished items
- Keep task lists organized

**Parameters:**

- `tasklistId` (string, required): Task list ID

### list-keep-notes

**Label:** List Google Keep Notes

**Description:** List all notes from Google Keep.

Use this to:

- View all your Keep notes
- Get note IDs for other operations
- Browse your notes
- Manage your note collection

**Parameters:**

- `maxResults` (number, optional): Maximum number of notes (default: 10)

### search-keep-notes

**Label:** Search Google Keep Notes

**Description:** Search Keep notes by text.

Use this to:

- Find notes by content
- Search through your notes
- Discover specific information
- Filter notes by criteria

**Parameters:**

- `query` (string, required): Search query
- `maxResults` (number, optional): Maximum number of results (default: 10)

### get-keep-note

**Label:** Get Google Keep Note

**Description:** Get a note from Google Keep.

Use this to:

- View note content
- Get note details
- Read note information
- Retrieve specific note by ID

**Parameters:**

- `noteId` (string, required): Note ID or name (e.g., notes/abc123)

### keep-attachment

**Label:** Download Keep Attachment

**Description:** Download an attachment from a Keep note.

Use this to:

- Download note attachments
- Get file content
- Retrieve attachment data
- Save attachments locally

**Parameters:**

- `attachmentName` (string, required): Attachment name (e.g., notes/abc123/attachments/xyz789)
- `mimeType` (string, optional): MIME type of attachment (e.g., image/jpeg)
- `out` (string, optional): Output file path (optional)

### get-docs-info

**Label:** Get Google Doc Info

**Description:** Get metadata for a Google Doc.

Use this to:

- View document details
- See document type and size
- Get document links
- Retrieve document information by ID

**Parameters:**

- `docId` (string, required): Google Doc ID

### export-docs

**Label:** Export Google Doc

**Description:** Export a Google Doc to PDF, DOCX, or TXT format.

Use this to:

- Download documents in various formats
- Get documents as plain text
- Export for offline use
- Convert Google Docs to other formats

**Parameters:**

- `docId` (string, required): Google Doc ID
- `format` (string, optional): Export format (pdf|docx|txt) - default: pdf

### create-docs

**Label:** Create Google Doc

**Description:** Create a new Google Doc.

Use this to:

- Create new documents
- Start with a blank document
- Get document ID and link
- Create documents programmatically

**Parameters:**

- `title` (string, required): Document title
- `content` (string, optional): Initial content (optional)

### copy-docs

**Label:** Copy Google Doc

**Description:** Copy a Google Doc to create a new document.

Use this to:

- Duplicate documents
- Create new versions
- Clone existing content
- Make copies for templates

**Parameters:**

- `docId` (string, required): Source Google Doc ID
- `title` (string, required): New document title

### cat-docs

**Label:** View Google Doc as Text

**Description:** Print a Google Doc as plain text.

Use this to:

- View document content as plain text
- Get document content programmatically
- Read document content without formatting
- Process document text

**Parameters:**

- `docId` (string, required): Google Doc ID
