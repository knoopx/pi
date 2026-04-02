# Hooks Extension

Run shell hooks on pi lifecycle events.

## Events

Supported events:

- `session_start`
- `session_shutdown`
- `turn_start`
- `turn_end`
- `agent_start`
- `agent_end`
- `tool_call`
- `tool_result`

Only `tool_call` can block tool execution.

## Config Locations

- Global: `~/.pi/agent/settings.json` under key `hooks`
- Project: `.pi/hooks.json`
- Defaults: `agent/extensions/hooks/defaults.json`

Resolution behavior:

- Global config overrides defaults.
- Project config merges into defaults by group name.

## Rule Schema

```json
[
  {
    "group": "typescript",
    "pattern": "{tsconfig.json,tsconfig.*.json}",
    "hooks": [
      {
        "event": "tool_result",
        "context": "file_name",
        "pattern": "\\.(ts|tsx|js|jsx)$",
        "command": "bun run typecheck 2>&1 | { grep \"%file%\" || true; }",
        "timeout": 60000,
        "notify": true
      }
    ]
  }
]
```

Hook fields:

- `event` (required)
- `command` (required)
- `context` (optional): `tool_name` | `file_name` | `command`
- `pattern` (optional)
- `cwd` (optional)
- `timeout` (optional, ms)
- `notify` (optional)

## Matching Semantics

### `tool_name` / `file_name`

`pattern` is regular expression.

### `command`

`pattern` uses token matching (same as guardrails):

- `?` = one token
- `*` = zero or more tokens
- literals match exactly (with `*` wildcard allowed inside literal token)

Examples:

- `npm *`
- `? run dev *`
- `rm -rf /*`

Matching is segment-based (`|`, `&&`, `||`, `;`) with env/wrapper normalization.

## Variable Substitution

In `command` strings:

- `%file%`
- `%tool%`
- `%cwd%`

## Hook Input / Output

Hooks receive JSON on stdin and may return JSON on stdout.

Input includes context such as:

- `cwd`
- `hook_event_name`
- `tool_name`
- `tool_input`
- `tool_call_id`
- `tool_response` (for `tool_result`)

Output supports:

- `continue: false`
- `stopReason`
- `decision: "block"` + `reason`
- `suppressOutput`
- `systemMessage`
- `hookSpecificOutput.permissionDecision` (`allow` | `deny` | `ask`)
- `hookSpecificOutput.permissionDecisionReason`
- `hookSpecificOutput.additionalContext`

## Blocking Rules

A hook can block when:

- it exits with code `2`
- JSON output sets `decision: "block"`
- for `tool_call`, JSON sets `permissionDecision: "deny"`

`edit` and `write` are treated as non-blocking for hook failures.

## Commands

- `/hooks-reload`
- `/hooks-list`
