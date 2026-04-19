# Guardrails

Security rules that block or confirm risky tool calls.

## Configuration

Guardrails are loaded from:

- Defaults: `agent/extensions/guardrails/defaults.ts`

The `enabled` flag is stored in `~/.pi/agent/settings.json` under the `guardrails` key.

## Commands

- `/guardrails on` — enable guardrails
- `/guardrails off` — disable guardrails
- `/guardrails:audit` — validate patterns and list active rules

A rule has:

- `context`: `command` | `file_name` | `file_content`
- `pattern`: matcher string
- `file_pattern` (optional): regex to filter which files the rule applies to (for `file_name`/`file_content` contexts)
- `includes` (optional): additional matcher that must match
- `excludes` (optional): matcher that must **not** match
- `scope` (optional): `project` | `external` to restrict rule to project files or external files only
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

## Scope Option

The `scope` option restricts rules to specific file locations:

- `scope: "project"` — rule only applies to files within the project directory
- `scope: "external"` — rule only applies to files outside the project directory
- no scope — rule applies to all files regardless of location

### Example

```json
[
  {
    "group": "project-only",
    "pattern": "*",
    "rules": [
      {
        "context": "file_name",
        "pattern": "secret",
        "scope": "project",
        "action": "block",
        "reason": "Do not edit secrets in project files"
      }
    ]
  },
  {
    "group": "external-only",
    "pattern": "*",
    "rules": [
      {
        "context": "file_name",
        "pattern": "config",
        "scope": "external",
        "action": "confirm",
        "reason": "Modifying external config files"
      }
    ]
  }
]
```

This allows you to apply different rules to project files vs. system/external files.

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

`defaults.ts` includes guardrails for:

- package manager usage
- interactive command prevention
- dangerous command confirmation (`rm -rf`, `sudo`, `dd`, etc.)
- jj safety rules
- lock-file protection
- test/lint hygiene
