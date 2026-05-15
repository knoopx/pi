---
name: pi-session-logs
topic: Pi Session Logs
description: "Query pi agent session logs as JSON Lines using Nushell pipelines. Use when debugging agent sessions, analyzing tool calls, or tracking file access in session history."
token_cost: 250
keywords: ["pi", "session", "log", "debug", "tool", "agent"]
requires_tools: [nu]
---

# pi-session-logs

Query pi agent session logs stored as JSON Lines (`.jsonl`) files in `~/.pi/agent/sessions/<project-path>/`. Each line is a JSON object representing a session event.

## Define the Helper Function

```nu
def open-jsonl [file: path] {
    open $file --raw | lines | each { from json }
}
```

## Entry Types

- **session** — metadata (version, id, timestamp, cwd)
- **message** — user or assistant messages with content and tool calls
- **model_change** — provider/model switches
- **thinking_level_change** — thinking level adjustments
- **custom_message** — hook output/errors, VCS notifications
- **compaction** — context summary when session was truncated

## Loading & Filtering

```nu
# Load a single session
open-jsonl ~/.pi/agent/sessions/<project>/<session>.jsonl

# Load all sessions from a project
ls ~/.pi/agent/sessions/<project>/*.jsonl
| each { |f| open-jsonl $f.name } | flatten
```

## Finding Tool Calls

Extract all tool calls from assistant messages:

```nu
# All tool calls with names and arguments
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content | flatten
| where type == "toolCall" | select id name arguments

# Bash commands specifically
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content | flatten
| where type == "toolCall" | where name == "bash"
| get arguments.command

# Files read
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content | flatten
| where type == "toolCall" | where name == "read"
| get arguments.path

# Thinking content
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content | flatten
| where type == "thinking" | get thinking
```

## Hook Errors & VCS Notifications

```nu
# All hook errors (eslint, typecheck failures)
open-jsonl session.jsonl | where type == "custom_message" | where customType == "hook-error"
| select timestamp content

# VCS notifications (jj squashes)
open-jsonl session.jsonl | where type == "custom_message"
| where customType | str starts-with "Squashed"
| select customType content timestamp
```

## Session Statistics

```nu
# Count events by type
open-jsonl session.jsonl | get type | uniq --count

# Count tool calls by type
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.content | flatten | where type == "toolCall"
| get name | uniq --count

# Token usage
open-jsonl session.jsonl
| where type == "message" | where message.role == "assistant"
| get message.usage | flatten | math sum
```

## Custom Helper Functions

```nu
def "session-stats" [file: path] {
    let data = (open-jsonl $file)
    {
        total_events: ($data | length),
        messages: ($data | where type == "message" | length),
        tool_calls: ($data | where type == "message" | where message.role == "assistant" | get message.content | flatten | where type == "toolCall" | length),
        hook_errors: ($data | where type == "custom_message" | where customType == "hook-error" | length)
    }
}
```

## Constraints

- Session paths contain encoded directory paths with `--` prefix/suffix
- Tool calls are embedded in assistant messages under `message.content[]` with `type == "toolCall"`
- Use `flatten` to extract nested arrays from `message.content`
- Timestamps are ISO 8601 strings or Unix milliseconds
