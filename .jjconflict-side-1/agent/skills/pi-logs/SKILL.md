---
name: pi-logs
description: "Query pi agent session logs using Nushell's structured data pipeline. Use when debugging sessions, analyzing tool usage, finding commands run, or tracking file access patterns."
---

# pi-logs

Query pi agent session logs using Nushell's structured data pipeline.

## Quick Start

```bash
# Load and view recent sessions
ls ~/.pi/agent/sessions/ | get name | first 5

# Query a specific session log
open ~/.pi/agent/sessions/<project-path>/<session-file>.jsonl --raw | lines | each { from json } | first 10

# Find all bash commands run
open-jsonl session.jsonl | where type == "message" | where message.role == "assistant"
```

## Log Structure

Pi agent logs are stored as JSON Lines (`.jsonl`) files in `~/.pi/agent/sessions/<project-path>/`. Each line is a JSON object.

### Entry Types

#### `session`

Session metadata (first entry in each file).

```json
{
  "type": "session",
  "version": 3,
  "id": "5741eacc-682e-472b-b42a-6d5ebf0105cb",
  "timestamp": "2026-04-10T19:12:00.750Z",
  "cwd": "/home/knoopx/Projects/knoopx/pi"
}
```

**Fields:** `version`, `id`, `timestamp`, `cwd`

---

#### `message`

User, assistant, or tool messages.

**User message:**

```json
{
  "type": "message",
  "id": "7bb32c72",
  "parentId": "380e238c",
  "timestamp": "2026-04-10T19:12:38.654Z",
  "message": {
    "role": "user",
    "content": [{ "type": "text", "text": "verify skill..." }],
    "timestamp": 1775848358650
  }
}
```

**Assistant message with tool call:**

```json
{
  "type": "message",
  "id": "cba9a752",
  "parentId": "7bb32c72",
  "timestamp": "2026-04-10T19:12:43.718Z",
  "message": {
    "role": "assistant",
    "content": [
      {
        "type": "thinking",
        "thinking": "...",
        "thinkingSignature": "reasoning_content"
      },
      {
        "type": "toolCall",
        "id": "LkmAH1oV...",
        "name": "read",
        "arguments": { "path": "..." }
      }
    ],
    "api": "openai-completions",
    "provider": "local",
    "model": "unsloth/Qwen3.5-27B-GGUF",
    "usage": {
      "input": 12002,
      "output": 64,
      "cacheRead": 0,
      "cacheWrite": 0,
      "totalTokens": 12066
    },
    "stopReason": "toolUse",
    "timestamp": 1775848358650,
    "responseId": "chatcmpl-..."
  }
}
```

**Fields:**

- Top-level: `id`, `parentId`, `timestamp`
- `message.role`: "user" or "assistant"
- `message.content[]`: Array of content items with `type` field:
  - `{ type: "text", text: "..." }`
  - `{ type: "thinking", thinking: "...", thinkingSignature: "..." }`
  - `{ type: "toolCall", id: "...", name: "...", arguments: {...} }`
- `message.api`: "openai-completions"
- `message.provider`: "local", "anthropic", etc.
- `message.model`: Model name/ID
- `message.usage`: Token usage stats
- `message.stopReason`: "stop", "toolUse", "aborted", etc.

---

#### `model_change`

Model or provider switch.

```json
{
  "type": "model_change",
  "id": "80e34ca7",
  "parentId": null,
  "timestamp": "2026-04-10T19:12:00.855Z",
  "provider": "local",
  "modelId": "unsloth/Qwen3.5-27B-GGUF"
}
```

**Fields:** `id`, `parentId`, `timestamp`, `provider`, `modelId`

---

#### `thinking_level_change`

Thinking level adjustment (low/medium/high).

```json
{
  "type": "thinking_level_change",
  "id": "380e238c",
  "parentId": "80e34ca7",
  "timestamp": "2026-04-10T19:12:00.855Z",
  "thinkingLevel": "medium"
}
```

**Fields:** `id`, `parentId`, `timestamp`, `thinkingLevel`

---

#### `custom_message`

Hook output, errors, and VCS notifications.

**Hook error:**

```json
{
  "type": "custom_message",
  "customType": "hook-error",
  "content": "Hook error:\nESLint: 10.2.0\n...",
  "display": true,
  "id": "7a51fa2e",
  "parentId": "faf0296b",
  "timestamp": "2026-04-10T18:39:04.378Z"
}
```

**VCS notification:**

```json
{
  "type": "custom_message",
  "customType": "Squashed change xoqlnppl into change yxqqokrx",
  "content": [{ "type": "text", "text": "Working copy (@) now at: ..." }],
  "display": true,
  "id": "fbdc57fb",
  "parentId": "e7ca4d4d",
  "timestamp": "2026-04-10T18:47:15.462Z"
}
```

**Fields:** `customType`, `content`, `display`, `id`, `parentId`, `timestamp`

**customType values:**

- `"hook"` - Hook output (eslint, typecheck success)
- `"hook-error"` - Hook errors
- `"Squashed change X into change Y"` - jj/VCS notifications

---

#### `compaction`

Context compaction summary when session is truncated.

```json
{
  "type": "compaction",
  "id": "26b7c5ac",
  "parentId": "ca53199c",
  "timestamp": "2026-04-10T17:09:03.200Z",
  "summary": "## Goal\n- ...\n\n## Progress\n...",
  "firstKeptEntryId": "5cd3d2eb",
  "tokensBefore": 266602,
  "details": {
    "readFiles": ["..."],
    "modifiedFiles": ["..."]
  },
  "fromHook": false
}
```

**Fields:** `id`, `parentId`, `timestamp`, `summary`, `firstKeptEntryId`, `tokensBefore`, `details`, `fromHook`

---

## Helper Function

Define this helper once for cleaner queries:

```nu
# Add to your env.nu or define inline
def open-jsonl [file: path] {
    open $file --raw | lines | each { from json }
}
```

## Core Commands

### Loading Session Logs

```nu
# Load a single session file
open-jsonl ~/.pi/agent/sessions/<project-path>/<session-file>.jsonl

# Or without helper:
open ~/.pi/agent/sessions/<project-path>/<session-file>.jsonl --raw | lines | each { from json }

# Load all sessions from a project
ls ~/.pi/agent/sessions/<project-path>/*.jsonl
| each { |f| open-jsonl $f.name } | flatten

# Load most recent session
ls ~/.pi/agent/sessions/<project-path>/*.jsonl
| sort-by modified --reverse | first 1 | get name | open-jsonl
```

### Filtering by Type

```nu
# Get all messages
open-jsonl session.jsonl | where type == "message"

# Get user messages
open-jsonl session.jsonl | where type == "message" | where message.role == "user"

# Get assistant messages
open-jsonl session.jsonl | where type == "message" | where message.role == "assistant"

# Get tool calls from assistant messages
open-jsonl session.jsonl
| where type == "message"
| where message.role == "assistant"
| where ($in.message.content | any { |c| $c.type == "toolCall" })

# Get hook output (eslint, typecheck, etc.)
open-jsonl session.jsonl | where type == "custom_message"
| select customType content display

# Get hook errors only
open-jsonl session.jsonl | where type == "custom_message"
| where customType == "hook-error"
| select customType content timestamp

# Get VCS notifications (jj squashes, etc.)
open-jsonl session.jsonl | where type == "custom_message"
| where customType | str starts-with "Squashed"
| select customType content timestamp

# Get compaction summaries
open-jsonl session.jsonl | where type == "compaction"
| select timestamp firstKeptEntryId tokensBefore details
```

### Finding Tool Calls

```nu
# Extract all tool calls with their names and arguments
open-jsonl session.jsonl
| where type == "message"
| where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall"
| select id name arguments

# Get bash commands specifically
open-jsonl session.jsonl
| where type == "message"
| where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "bash"
| get arguments.command

# Get all read operations
open-jsonl session.jsonl
| where type == "message"
| where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "read"
| get arguments.path

# Get thinking content
open-jsonl session.jsonl
| where type == "message"
| where message.role == "assistant"
| get message.content
| flatten
| where type == "thinking"
| get thinking
```

## Common Queries

### What Commands Were Run?

```nu
# All bash commands in a session
open-jsonl session.jsonl
| where type == "message"
| where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "bash"
| get arguments.command

# All bash commands with their IDs (for tracking)
open-jsonl session.jsonl
| where type == "message"
| where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "bash"
| select id arguments.command
```

### What Hook Errors Occurred?

```nu
# All hook errors (eslint, typecheck, etc.)
open-jsonl session.jsonl
| where type == "custom_message" | where customType == "hook-error"
| select timestamp content

# Hook errors with timestamps
open-jsonl session.jsonl
| where type == "custom_message" | where customType == "hook-error"
| select customType timestamp content
```

### Tool Call Analysis

```nu
# Count tool calls by type
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall"
| get name | uniq --count

# Get unique tools used
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall"
| get name | uniq
```

### What Files Were Accessed?

```nu
# All files read
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "read"
| get arguments.path

# All files written (edit/write operations)
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name in ["edit", "write"]
| get arguments.path

# Unique files accessed
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name in ["read", "edit", "write"]
| get arguments.path | uniq
```

### Session Statistics

```nu
# Count different entry types
open-jsonl session.jsonl | get type | uniq --count

# Count message roles
open-jsonl session.jsonl
| where type == "message"
| get message.role | uniq --count

# Count tool calls by type
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall"
| get name | uniq --count

# Count custom_message types (hook, hook-error, etc.)
open-jsonl session.jsonl
| where type == "custom_message"
| get customType | uniq --count

# Token usage summary
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.usage
| flatten
| math sum
```

### Find Specific Patterns

```nu
# Find sessions where a specific command was run
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "bash"
| where ($in.arguments.command | str contains "jj diff")

# Find all grep operations
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "bash"
| where ($in.arguments.command | str contains "grep")
| get arguments.command

# Find file modifications
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name in ["edit", "write"]
| select id name arguments
```

### User Queries Analysis

```nu
# Get all user messages
open-jsonl session.jsonl
| where type == "message" | where message.role == "user"
| get message.content
| flatten
| where type == "text"
| get text

# Count user messages
open-jsonl session.jsonl
| where type == "message" | where message.role == "user"
| length

# Get user messages with timestamps
open-jsonl session.jsonl
| where type == "message" | where message.role == "user"
| select timestamp message
```

### Model and Provider Info

```nu
# Get model changes
open-jsonl session.jsonl | where type == "model_change"
| select provider modelId timestamp

# Get thinking level changes
open-jsonl session.jsonl | where type == "thinking_level_change"
| select thinkingLevel timestamp

# Get token usage from assistant messages
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| select message.usage message.model
```

## Custom Commands

```nu
# Quick session stats
def "session-stats" [file: path] {
    let data = (open-jsonl $file)
    {
        total_events: ($data | length)
        messages: ($data | where type == "message" | length)
        user_messages: ($data | where type == "message" | where message.role == "user" | length)
        assistant_messages: ($data | where type == "message" | where message.role == "assistant" | length)
        tool_calls: ($data | where type == "message" | where message.role == "assistant" | get message.content | flatten | where type == "toolCall" | length)
        custom_messages: ($data | where type == "custom_message" | length)
        hook_errors: ($data | where type == "custom_message" | where customType == "hook-error" | length)
        compactions: ($data | where type == "compaction" | length)
        session_id: ($data | where type == "session" | get id | first)
    }
}

# Get model info
def "model-stats" [file: path] {
    open-jsonl $file
    | where type == "message" | where message.role == "assistant"
    | select message.model message.provider message.usage
    | first
}

# Get hook errors
def "hook-errors" [file: path] {
    open-jsonl $file
    | where type == "custom_message" | where customType == "hook-error"
    | select timestamp content
}

# Get bash commands
def "bash-history" [file: path] {
    open-jsonl $file
    | where type == "message" | where message.role == "assistant"
    | get message.content
    | flatten
    | where type == "toolCall" | where name == "bash"
    | get arguments.command | uniq
}

# Get all custom messages by type
def "custom-messages" [file: path] {
    open-jsonl $file
    | where type == "custom_message"
    | get customType | uniq --count
}

# Find files modified
def "files-modified" [file: path] {
    open-jsonl $file
    | where type == "message" | where message.role == "assistant"
    | get message.content
    | flatten
    | where type == "toolCall" | where name in ["edit", "write"]
    | get arguments.path | uniq
}

# Get compaction summaries
def "compactions" [file: path] {
    open-jsonl $file
    | where type == "compaction"
    | select timestamp firstKeptEntryId tokensBefore
    | each { |c|
        {
            timestamp: $c.timestamp
            tokensBefore: $c.tokensBefore
            readFiles: ($c.details.readFiles | length)
            modifiedFiles: ($c.details.modifiedFiles | length)
        }
    }
}
```

## Multi-Session Queries

```nu
# Compare tool usage across sessions
ls ~/.pi/agent/sessions/<project-path>/*.jsonl | each { |f|
    let data = (open-jsonl $f.name)
    let tool_calls = ($data | where type == "message" | where message.role == "assistant" | get message.content | flatten | where type == "toolCall" | get name | uniq --count)
    {
        file: $f.name
        tools: $tool_calls
    }
}

# Aggregate statistics across all sessions
ls ~/.pi/agent/sessions/<project-path>/*.jsonl | each { |f|
    open-jsonl $f.name
} | flatten | where type == "message" | where message.role == "assistant" | get message.content | flatten | where type == "toolCall" | get name | uniq --count
```

## Practical Examples

### Debug a Failed Session

```nu
# Load session and find what went wrong
let session = (open-jsonl "failed_session.jsonl")

# Check for aborted messages
$session | where type == "message" | where message.role == "assistant" | where message.stopReason == "aborted"

# Check for error messages
$session | where type == "message" | where message.role == "assistant" | where message.errorMessage != null

# Check for hook errors (eslint, typecheck failures)
$session | where type == "custom_message" | where customType == "hook-error"
| select timestamp content
```

### Find How to Run a Command

```nu
# Search for a specific command pattern
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "bash"
| where ($in.arguments.command | str contains "bun run")
| get arguments.command

# Find all build commands
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name == "bash"
| where ($in.arguments.command | str contains --ignore-case "build" or $in.arguments.command | str contains "bun run")
| get arguments.command | uniq
```

### Track File Changes Over Time

```nu
# Get all file operations in order
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name in ["read", "edit", "write"]
| select timestamp name arguments.path

# Group by file
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content
| flatten
| where type == "toolCall" | where name in ["read", "edit", "write"]
| select timestamp name path: arguments.path
| group-by path
```

## Constraints

- Session paths contain encoded directory paths with `--` prefix/suffix
- JSON Lines format: each line is a separate JSON object
- Tool calls are embedded in assistant messages under `message.content[]` with `type == "toolCall"`
- Timestamps are ISO 8601 format (string) or Unix milliseconds (number)
- Use `flatten` to extract nested arrays from `message.content`
- Some fields may be `null` - filter with `where $it != null`
- `custom_message.customType`: "hook" for output, "hook-error" for errors, "Squashed change..." for VCS
- `compaction` entries contain summarized context when sessions are truncated
- Entry IDs are unique within a session; `parentId` links related entries

## Tips

- Use `jq` for complex JSON transformations if nushell struggles
- Save filtered results: `open session.jsonl | where ... | save filtered.jsonl`
- Load multiple sessions: `ls *.jsonl | each { |f| open-jsonl $f.name } | flatten`
- Use `str contains --ignore-case` for case-insensitive command searches
- Pipe to `table` or `to md` for better formatting in reports
- Tool calls don't have separate result entries; results are shown in subsequent assistant messages
- Use `message.usage` fields to track token consumption per assistant response
