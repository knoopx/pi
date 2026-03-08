# Guardrails

Security rules that block or confirm risky tool calls.

## Configuration

Guardrails are loaded from:

- Global rules: `~/.pi/agent/settings.json` under key `guardrails`
- Defaults: `agent/extensions/guardrails/defaults.json`

Runtime command state is also stored in `~/.pi/agent/settings.json` under the same `guardrails` object (`enabled`).

## Command

- `/guardrails on`
- `/guardrails off`

Toggles guardrails enforcement and persists the setting.

A rule has:

- `context`: `command` | `file_name` | `file_content`
- `pattern`: matcher string
- `includes` (optional): additional matcher that must match
- `excludes` (optional): matcher that must **not** match
- `action`: `block` | `confirm`
- `reason`: message shown to user

## Command Pattern Syntax

For `context: "command"`, `pattern`/`includes`/`excludes` use token matching (not regex):

- `?` = match exactly one token
- `*` = match zero or more tokens
- `{token1,token2}` = match one of multiple literal tokens
- literal token = exact match
- literal token supports wildcard `*` inside token (`mkfs.*`, `/*`, `*@^*`, `{python,python3*}`)

Matching is done against parsed shell command segments (split by `|`, `&&`, `||`, `;`).
Leading env assignments and wrappers (`env`, `nohup`, `time`, etc.) are normalized out.

### Examples

- `npm *` → any npm command
- `{npm,bun} test *` → npm or bun test commands
- `? run dev *` → any package manager running dev
- `jj squash *` with `excludes: "* -m *"` → block squash without `-m`
- `dd * if=? *` → dd commands containing `if=`
- `nix ? . *` → local flake invocation with `.`

## Non-command Contexts

For `file_name` and `file_content`, `pattern`/`includes`/`excludes` are regular expressions.

## Minimal Example

```json
[
  {
    "group": "bun",
    "pattern": "bun.lock",
    "rules": [
      {
        "context": "command",
        "pattern": "npm *",
        "action": "block",
        "reason": "Use bun instead of npm"
      }
    ]
  }
]
```

## Built-in Defaults

`defaults.json` includes guardrails for:

- package manager usage
- interactive command prevention
- dangerous command confirmation (`rm -rf`, `sudo`, `dd`, etc.)
- jj safety rules
- lock-file protection
- test/lint hygiene
