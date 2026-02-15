# Hooks Extension

Run shell commands at specific points in pi's lifecycle. Inspired by [Claude Code hooks](https://code.claude.com/docs/en/hooks).

## Overview

Hooks are user-defined shell commands that execute automatically at specific points during a pi session. They provide deterministic control over pi's behavior, ensuring certain actions always happen rather than relying on the LLM to choose to run them.

Use hooks to:

- **Enforce project rules**: auto-format files, run linters, validate commits
- **Automate workflows**: run tests after edits, type-check on save
- **Integrate tools**: send notifications, log activity, sync state

## Hook Lifecycle

Hooks fire at specific points during a pi session:

```
session_start
    │
    ▼
┌─────────────────────────────────────────┐
│            Agentic Loop                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │          turn_start               │  │
│  │              │                    │  │
│  │              ▼                    │  │
│  │         agent_start               │  │
│  │              │                    │  │
│  │              ▼                    │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  tool_call ──► execution    │  │  │
│  │  │       │                     │  │  │
│  │  │       ▼                     │  │  │
│  │  │   tool_result               │  │  │
│  │  │       │                     │  │  │
│  │  └───────┼─────────────────────┘  │  │
│  │          │ (repeat for each tool) │  │
│  │          ▼                        │  │
│  │       agent_end                   │  │
│  │          │                        │  │
│  │          ▼                        │  │
│  │       turn_end                    │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
    │
    ▼
session_shutdown
```

### Event Reference

| Event              | When it fires                      | Can Block? | Claude Code Equivalent |
| :----------------- | :--------------------------------- | :--------- | :--------------------- |
| `session_start`    | When a session begins              | No         | `SessionStart`         |
| `turn_start`       | When a conversation turn starts    | No         | —                      |
| `agent_start`      | When the agent starts processing   | No         | —                      |
| `tool_call`        | Before a tool executes             | **Yes**    | `PreToolUse`           |
| `tool_result`      | After a tool finishes successfully | No         | `PostToolUse`          |
| `agent_end`        | When the agent finishes processing | No         | `Stop`                 |
| `turn_end`         | When a conversation turn ends      | No         | —                      |
| `session_shutdown` | When the session terminates        | No         | `SessionEnd`           |

### How Blocking Works

Only `tool_call` hooks can block tool execution. When a hook command exits with code 2, the tool call is prevented and stderr is fed back to Claude as an error message.

**Note**: For a smooth editing experience, `edit` and `write` tools are treated as non-blocking—exit code 2 won't block them, only report an error.

## Quick Start

### 1. Create a hook configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "hooks": [
    {
      "group": "format-on-save",
      "pattern": "biome.json",
      "hooks": [
        {
          "event": "tool_result",
          "context": "tool_name",
          "pattern": "^(write|edit)$",
          "command": "biome format --write \"${file}\"",
          "timeout": 5000,
          "notify": false
        }
      ]
    }
  ]
}
```

### 2. Reload hooks

Use `/hooks-reload` command or restart pi.

### 3. Verify hooks are active

Use `/hooks-list` to see all configured hooks and their status.

## Configuration

### Configuration Locations

| Location                    | Scope          | Shareable |
| :-------------------------- | :------------- | :-------- |
| `~/.pi/agent/settings.json` | All projects   | No        |
| `.pi/hooks.json`            | Single project | Yes       |
| Extension `defaults.json`   | Default hooks  | No        |

**Resolution order:**

1. Global settings (`~/.pi/agent/settings.json`) completely override defaults if present
2. Project-level hooks (`.pi/hooks.json`) extend/merge with defaults
3. Extension defaults (`defaults.json`) used as fallback

### Configuration Schema

```json
[
  {
    "group": "group-name",
    "pattern": "file-glob-pattern",
    "hooks": [
      {
        "event": "tool_result",
        "context": "tool_name",
        "pattern": "^(write|edit)$",
        "command": "your-command \"${file}\"",
        "cwd": "/optional/working/dir",
        "timeout": 30000,
        "notify": true
      }
    ]
  }
]
```

### Group Properties

| Property  | Type       | Required | Description                                          |
| :-------- | :--------- | :------- | :--------------------------------------------------- |
| `group`   | string     | Yes      | Unique identifier for the hook group                 |
| `pattern` | string     | Yes      | Glob pattern to activate group (`*` = always active) |
| `hooks`   | HookRule[] | Yes      | Array of hook rules                                  |

Groups are **activated** when a file matching `pattern` exists in the project directory. Use `*` to always activate.

### Hook Rule Properties

| Property  | Type    | Default  | Description                                                   |
| :-------- | :------ | :------- | :------------------------------------------------------------ |
| `event`   | string  | required | Event to trigger on (see events table)                        |
| `command` | string  | required | Shell command to execute                                      |
| `context` | string  | —        | What to match against: `tool_name`, `file_name`, or `command` |
| `pattern` | string  | —        | Regex pattern to match against context                        |
| `cwd`     | string  | cwd      | Working directory for command                                 |
| `timeout` | number  | 30000    | Timeout in milliseconds                                       |
| `notify`  | boolean | true     | Show output in UI                                             |

### Variable Substitution

Commands support these variables:

| Variable  | Description                        | Available In               |
| :-------- | :--------------------------------- | :------------------------- |
| `${file}` | Path to the file being operated on | `tool_call`, `tool_result` |
| `${tool}` | Name of the tool being called      | `tool_call`, `tool_result` |
| `${cwd}`  | Current working directory          | All events                 |

### Context Matching

The `context` field determines what the `pattern` regex matches against:

| Context     | Description                            | Applies To                    |
| :---------- | :------------------------------------- | :---------------------------- |
| `tool_name` | Match against the tool name            | `tool_call`, `tool_result`    |
| `file_name` | Match against file paths in tool input | `read`, `edit`, `write` tools |
| `command`   | Match against bash commands            | `bash` tool only              |

If `context` and `pattern` are omitted, the hook runs for all matching events.

## Hook Input (stdin)

Hooks receive JSON input via stdin with context about the event. This is compatible with Claude Code's hook input format.

### Common Input Fields

| Field             | Type   | Description                       |
| :---------------- | :----- | :-------------------------------- |
| `cwd`             | string | Current working directory         |
| `hook_event_name` | string | Name of the event that fired      |
| `tool_name`       | string | Tool name (for tool events)       |
| `tool_input`      | object | Tool parameters (for tool events) |
| `tool_call_id`    | string | Tool call ID (for tool events)    |
| `tool_response`   | object | Tool result (for `tool_result`)   |

### Example Input for `tool_call`

```json
{
  "cwd": "/home/user/project",
  "hook_event_name": "tool_call",
  "tool_name": "bash",
  "tool_input": {
    "command": "npm test"
  },
  "tool_call_id": "toolu_01ABC123"
}
```

### Example Input for `tool_result`

```json
{
  "cwd": "/home/user/project",
  "hook_event_name": "tool_result",
  "tool_name": "write",
  "tool_input": {
    "path": "/home/user/project/src/index.ts",
    "content": "..."
  },
  "tool_call_id": "toolu_01ABC123",
  "tool_response": {
    "content": [{ "type": "text", "text": "File written successfully" }],
    "details": { "path": "/home/user/project/src/index.ts" },
    "isError": false
  }
}
```

## Exit Codes

Hook exit codes determine behavior:

| Exit Code | Meaning            | Effect                                              |
| :-------- | :----------------- | :-------------------------------------------------- |
| `0`       | Success            | Action proceeds; parse JSON output for decisions    |
| `2`       | Blocking error     | Blocks the action (`tool_call` only), stderr→Claude |
| Other     | Non-blocking error | Logged, execution continues                         |

## JSON Output (stdout)

Hooks can return JSON on stdout (exit code 0) for fine-grained control. This is compatible with Claude Code's hook output format.

### Universal Output Fields

| Field            | Type    | Description                                    |
| :--------------- | :------ | :--------------------------------------------- |
| `continue`       | boolean | If `false`, stops Claude processing entirely   |
| `stopReason`     | string  | Message shown to user when `continue` is false |
| `suppressOutput` | boolean | If `true`, hides stdout from notifications     |
| `systemMessage`  | string  | Warning message shown to user                  |
| `decision`       | string  | `"block"` to prevent the action                |
| `reason`         | string  | Explanation when `decision` is `"block"`       |

### Event-Specific Output (hookSpecificOutput)

For `tool_call` (PreToolUse equivalent), use `hookSpecificOutput`:

| Field                      | Type   | Description                                |
| :------------------------- | :----- | :----------------------------------------- |
| `hookEventName`            | string | Must match the event (e.g., `"tool_call"`) |
| `permissionDecision`       | string | `"allow"`, `"deny"`, or `"ask"`            |
| `permissionDecisionReason` | string | Reason for the decision                    |
| `additionalContext`        | string | Context to inject into conversation        |

### Example: Block with JSON Output

```bash
#!/bin/bash
# block-dangerous.sh

INPUT=$(cat)  # Read JSON from stdin
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -q 'rm -rf /'; then
  # Return JSON to block with reason
  echo '{"decision": "block", "reason": "Destructive command blocked by policy"}'
  exit 0
fi

exit 0  # Allow (no output needed)
```

### Example: Block with Exit Code 2

```bash
#!/bin/bash
# block-rm.sh - Simple blocking with exit code

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -q 'rm -rf /'; then
  echo "Blocked: rm -rf / commands are not allowed" >&2
  exit 2  # Blocking error - stderr goes to Claude
fi

exit 0  # Allow
```

### Example: Inject Additional Context

```bash
#!/bin/bash
# add-context.sh - Add context on session start

INPUT=$(cat)
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name')

if [ "$EVENT" = "session_start" ]; then
  # Inject context that Claude will see
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "session_start",
    "additionalContext": "Project uses TypeScript strict mode. Always use explicit types."
  }
}
EOF
fi
```

### Example: PreToolUse-style Permission Control

```bash
#!/bin/bash
# permission-check.sh - Claude Code compatible permission decision

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Block sudo commands
if [ "$TOOL" = "bash" ] && echo "$COMMAND" | grep -q '^sudo '; then
  cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "tool_call",
    "permissionDecision": "deny",
    "permissionDecisionReason": "sudo commands require manual approval"
  }
}
EOF
  exit 0
fi

exit 0  # Allow
```

## Examples

### Format Files with Prettier

```json
{
  "group": "prettier-format",
  "pattern": ".prettierrc*",
  "hooks": [
    {
      "event": "tool_result",
      "context": "file_name",
      "pattern": "\\.(ts|tsx|js|jsx|json|css|md)$",
      "command": "prettier --write \"${file}\"",
      "timeout": 5000,
      "notify": false
    }
  ]
}
```

### Type-Check TypeScript Files

```json
{
  "group": "typescript-check",
  "pattern": "tsconfig.json",
  "hooks": [
    {
      "event": "tool_result",
      "context": "file_name",
      "pattern": "\\.(ts|tsx)$",
      "command": "tsc --noEmit 2>&1 | grep \"${file}\" || true",
      "timeout": 60000,
      "notify": true
    }
  ]
}
```

### Run ESLint After Agent Finishes

```json
{
  "group": "eslint-check",
  "pattern": "eslint.config.*",
  "hooks": [
    {
      "event": "agent_end",
      "command": "eslint .",
      "timeout": 120000,
      "notify": true
    }
  ]
}
```

### Run Tests on Test File Changes

```json
{
  "group": "vitest-auto",
  "pattern": "vitest.config.*",
  "hooks": [
    {
      "event": "tool_result",
      "context": "file_name",
      "pattern": "\\.test\\.tsx?$",
      "command": "vitest run --reporter=dot \"${file}\"",
      "timeout": 60000,
      "notify": true
    }
  ]
}
```

### Format Nix Files

```json
{
  "group": "nix-format",
  "pattern": "*",
  "hooks": [
    {
      "event": "tool_result",
      "context": "file_name",
      "pattern": "\\.nix$",
      "command": "alejandra -q \"${file}\"",
      "timeout": 5000,
      "notify": false
    }
  ]
}
```

### Desktop Notification on Completion

```json
{
  "group": "notify-done",
  "pattern": "*",
  "hooks": [
    {
      "event": "agent_end",
      "command": "notify-send 'Pi' 'Agent finished'",
      "notify": false
    }
  ]
}
```

### Block rm -rf Commands

```json
{
  "group": "bash-safety",
  "pattern": "*",
  "hooks": [
    {
      "event": "tool_call",
      "context": "command",
      "pattern": "rm\\s+-rf\\s+/",
      "command": "echo 'Blocked: dangerous rm command' >&2 && exit 2"
    }
  ]
}
```

## Commands

| Command         | Description                                 |
| :-------------- | :------------------------------------------ |
| `/hooks-reload` | Reload hooks configuration from disk        |
| `/hooks-list`   | List all configured hooks with their status |

## Abort Handling

Hooks are **skipped** when:

- A tool result indicates the operation was aborted
- The turn ends due to an abort
- The agent ends due to an abort

This prevents hooks from running on incomplete operations.

## Comparison with Claude Code Hooks

This extension is inspired by [Claude Code hooks](https://code.claude.com/docs/en/hooks) with some differences:

### Feature Comparison

| Feature               | Pi Hooks | Claude Code | Notes                            |
| :-------------------- | :------- | :---------- | :------------------------------- |
| Shell command hooks   | ✅       | ✅          |                                  |
| Event-based triggers  | ✅       | ✅          | Different event names            |
| Regex matchers        | ✅       | ✅          |                                  |
| Variable substitution | ✅       | ✅          | `${file}`, `${tool}`, `${cwd}`   |
| Blocking tool calls   | ✅       | ✅          | Exit code 2                      |
| Timeout configuration | ✅       | ✅          |                                  |
| Project-level config  | ✅       | ✅          | `.pi/hooks.json`                 |
| JSON stdin input      | ❌       | ✅          | Planned enhancement              |
| JSON output parsing   | ❌       | ✅          | Planned enhancement              |
| `permissionDecision`  | ❌       | ✅          | Allow/deny/ask for PreToolUse    |
| `additionalContext`   | ❌       | ✅          | Inject context into conversation |
| Prompt-based hooks    | ❌       | ✅          | LLM evaluation for decisions     |
| Agent-based hooks     | ❌       | ✅          | Subagent verification            |
| Async hooks           | ❌       | ✅          | Background execution             |

### Event Mapping

| Pi Event           | Claude Code Equivalent | Description                         |
| :----------------- | :--------------------- | :---------------------------------- |
| `session_start`    | `SessionStart`         | Session begins                      |
| `session_shutdown` | `SessionEnd`           | Session terminates                  |
| `tool_call`        | `PreToolUse`           | Before tool executes (can block)    |
| `tool_result`      | `PostToolUse`          | After tool succeeds                 |
| `agent_end`        | `Stop`                 | Agent finishes responding           |
| `turn_start`       | —                      | Pi-specific: turn begins            |
| `turn_end`         | —                      | Pi-specific: turn ends              |
| `agent_start`      | —                      | Pi-specific: agent starts           |
| —                  | `UserPromptSubmit`     | Not yet implemented                 |
| —                  | `PostToolUseFailure`   | Use `tool_result` + check `isError` |
| —                  | `PermissionRequest`    | Not applicable (different model)    |
| —                  | `Notification`         | Not yet implemented                 |
| —                  | `SubagentStart/Stop`   | Not yet implemented                 |
| —                  | `PreCompact`           | Use pi extension events directly    |

### Pi Extension Events (Advanced)

For more control, you can write a pi extension that uses the full event API:

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  // Equivalent to Claude Code's PreToolUse with blocking
  pi.on("tool_call", async (event, ctx) => {
    if (
      event.toolName === "bash" &&
      event.input.command?.includes("rm -rf /")
    ) {
      return { block: true, reason: "Dangerous command blocked" };
    }
  });

  // Equivalent to Claude Code's PostToolUse
  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName === "write") {
      // Run formatter...
    }
  });

  // Equivalent to Claude Code's UserPromptSubmit
  pi.on("input", async (event, ctx) => {
    // Transform or validate user input
    return { action: "continue" };
  });

  // Inject context before agent runs (like SessionStart additionalContext)
  pi.on("before_agent_start", async (event, ctx) => {
    return {
      message: {
        customType: "hook-context",
        content: "Additional context from hooks",
        display: false,
      },
    };
  });
}
```

See [pi extensions documentation](../../../docs/extensions.md) for the full API.

## Troubleshooting

### Hooks not firing

1. **Check group activation**: The group `pattern` must match a file in your project
2. **Verify event name**: Must be one of the supported events
3. **Check regex syntax**: Test your `pattern` with a regex tester
4. **Use `/hooks-list`**: Shows which hooks are loaded and their active status

### Command not found

- Use absolute paths for scripts
- Ensure the command is in PATH
- For project scripts, use `${cwd}` variable: `"${cwd}/.hooks/format.sh"`

### Hooks timing out

- Increase the `timeout` value (in milliseconds)
- Optimize the command
- Consider running slow checks on `agent_end` instead of per-file

### Unexpected blocking

- Only `tool_call` hooks can block (exit code 2)
- `tool_result` hooks cannot block—the tool already ran
- `edit` and `write` are non-blocking even on `tool_call`

### Variable not substituted

- Ensure the variable is available for that event (see variable table)
- Check that the tool provides the expected input (e.g., `path` field)

## Default Hooks

The extension includes sensible defaults in `defaults.json`. View with `/hooks-list` or check the file directly.

## Migration from Biome/LSP Extensions

This hooks extension can replace:

1. **Biome extension**: Use file-based formatting hooks on `tool_result`
2. **LSP diagnostics**: Use type-check and lint hooks on `agent_end`

**Note**: This extension does not replace LSP tools (go-to-definition, references, hover). Those require the full LSP extension.
