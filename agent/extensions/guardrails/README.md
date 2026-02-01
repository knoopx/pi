# Guardrails

Security hooks to prevent potentially dangerous operations.

## Default Configuration

Guardrails comes with a comprehensive set of default rules to prevent common issues:

### JavaScript/Node.js Commands
- `node` - Blocked in favor of bun or bunx
- `npm` - Blocked in favor of bun or bunx

### Python Commands
- `pip` - Blocked in favor of uv or uvx
- `python`, `python2`, `python3` - Blocked in favor of uv or uvx
  - Exceptions: Virtual environment python commands are allowed (e.g., `.venv/bin/python`)

### Git Commands
- Write operations - Only read-only git commands are allowed:
  - ✅ `git status`, `git diff`, `git show`
  - ❌ `git add`, `git commit`, `git push`, `git checkout`, etc.

### JJ (JetBrains Jump) Commands
- Various jj commands blocked or require confirmation:
  - `jj diffedit`, `jj simplify`, `jj forget`, `jj undo`, `jj recover` - Blocked
  - `jj squash` without `-m` - Blocked (opens editor)
  - `jj split` without `-m` - Blocked (opens editor or diff view)
  - `jj resolve` without `--list` - Blocked (opens merge tool)
  - `jj describe` without `-m` - Blocked (opens editor)
  - `jj commit` without `-m` - Blocked (opens editor)
  - `jj -i/--interactive/--tool` - Blocked (opens diff editor)

### Nix Commands
- Local flake references - Must use proper prefixes:
  - ✅ `nix run path:./my-flake#output`
  - ✅ `nix run github:user/repo#output`
  - ✅ `nix run git+https://github.com/user/repo#output`
  - ❌ `nix run ./my-flake#output`

### Privilege Escalation Commands
- `sudo` and `su` - Blocked to prevent privilege escalation
  - ❌ `sudo apt update`
  - ❌ `su root`
  - Rationale: Agents should instruct system administrators to perform privileged operations

### File Edit Blocking - Lock Files
Prevents editing of auto-generated lock files:
- `package-lock.json` - Use bun install or bun update instead
- `bun.lockb` - Use bun install or bun update instead
- `yarn.lock` - Use yarn install or yarn upgrade instead
- `pnpm-lock.yaml` - Use pnpm install or pnpm update instead
- `poetry.lock` - Use poetry install or poetry update instead
- `uv.lock` - Use uv sync or uv lock instead
- `Cargo.lock` - Use cargo update instead
- `Gemfile.lock` - Use bundle install or bundle update instead
- `flake.lock` - Use nix flake update instead

## Configuration

Configuration is loaded from:

- **Global**: `~/.pi/agent/settings.json` under key `"guardrails"`
- **Defaults**: Built-in `defaults.json` (used when no global config exists)

### Settings Command

Run `/guardrails` to open an interactive settings UI for editing global config (`~/.pi/agent/settings.json`).

### Configuration Schema

```json
{
  "enabled": true,
  "groups": [
    {
      "group": "jj",
      "pattern": "^jj",
      "rules": [
        {
          "pattern": "^jj\\s+(?:diffedit|simplify|forget|undo|recover)",
          "action": "block",
          "reason": "jj diffedit and related commands are blocked. Use jj restore instead."
        }
      ]
    }
  ]
}
```

All fields are optional. Missing fields use defaults shown above.

### Configuration Details

#### `groups`

Array of groups with patterns and rules.

| Key | Required | Description |
|---|---|---|
| `group` | Required | Name of the group (human-readable identifier) |
| `pattern` | Required | Regex pattern to match the item (command or file) |
| `rules` | Required | Array of rule objects |

#### `rules`

Each rule defines what to do when the group pattern matches.

| Key | Required | Description |
|---|---|---|
| `pattern` | Required | Regex pattern to match the specific item |
| `action` | Required | `"block"` or `"confirm"` - whether to auto-block or prompt |
| `reason` | Required | Human-readable reason for blocking |

### Examples

#### Customize Python Rules

Allow virtual environment python commands:

```json
{
  "groups": [
    {
      "group": "python",
      "pattern": "^python",
      "rules": [
        {
          "pattern": "^(?!.*(?:/\\.venv/|/venv/|/env/).*python$)\\bpython\\b",
          "action": "block",
          "reason": "use uv or uvx instead"
        }
      ]
    }
  ]
}
```

#### Remove Nix Local Flake Blocking

```json
{
  "groups": [
    {
      "group": "nix",
      "pattern": "^nix",
      "rules": []
    }
  ]
}
```

#### Allow Sudo for Package Updates

```json
{
  "groups": [
    {
      "group": "privilege",
      "pattern": "^(sudo|su)",
      "rules": []
    }
  ]
}
```

#### Customize JJ Commands

Add jj diffedit to the blocked commands:

```json
{
  "groups": [
    {
      "group": "jj",
      "pattern": "^jj",
      "rules": [
        {
          "pattern": "^jj\\s+(?:diffedit|simplify|forget|undo|recover)",
          "action": "block",
          "reason": "jj diffedit and related commands are blocked. Use jj restore instead."
        }
      ]
    }
  ]
}
```

## Events

The extension emits events on the pi event bus for inter-extension communication.

### `guardrails:blocked`

Emitted when a tool call is blocked by any guardrail.

```typescript
interface GuardrailsBlockedEvent {
  feature: "blockedCommands";
  toolName: string;
  input: Record<string, unknown>;
  reason: string;
  userDenied?: boolean;
}
```

### `guardrails:dangerous`

Emitted when a blocked command with `action: "confirm"` is detected (before the confirmation dialog).

```typescript
interface GuardrailsDangerousEvent {
  command: string;
  description: string;
  pattern: string;
}
```

The [presenter extension](../presenter) listens for `guardrails:dangerous` events and plays a notification sound.
