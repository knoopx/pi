# Hooks Extension

Run shell commands after pi events based on patterns. Supersedes the biome and LSP extensions for formatting and linting.

## Features

- Define hook commands to run after various pi events
- Conditionally activate hooks based on file patterns in the project
- Filter hooks based on tool name, file paths, or bash commands
- Variable substitution for dynamic commands (`${file}`, `${tool}`, `${cwd}`)
- Configure via `defaults.json` or global `~/.pi/agent/settings.json`

## Default Hooks

The extension comes with sensible defaults for common use cases:

| Group | Pattern | Event | Description |
|-------|---------|-------|-------------|
| `biome-format` | `biome.json` | `tool_result` | Format files with Biome after write/edit |
| `prettier-format` | `.prettierrc*` | `tool_result` | Format files with Prettier after write/edit |
| `typescript-typecheck` | `tsconfig.json` | `agent_end` | Run `tsc --noEmit` after agent finishes |
| `eslint-check` | `eslint.config.*` | `agent_end` | Run ESLint after agent finishes |
| `pyright-check` | `pyrightconfig.json` | `agent_end` | Run Pyright type checking |
| `ruff-check` | `ruff.toml` | `agent_end` | Run Ruff linting |

## Configuration

### Structure

```json
[
  {
    "group": "typescript-typecheck",
    "pattern": "tsconfig.json",
    "hooks": [
      {
        "event": "agent_end",
        "command": "tsc --noEmit",
        "timeout": 60000,
        "notify": true
      }
    ]
  }
]
```

### Group Properties

| Property  | Type     | Description                                                     |
| --------- | -------- | --------------------------------------------------------------- |
| `group`   | string   | Group name for identification                                   |
| `pattern` | string   | File glob pattern to activate group (use `*` to always activate)|
| `hooks`   | HookRule[] | Array of hook rules                                           |

### Hook Rule Properties

| Property  | Type    | Default | Description                                      |
| --------- | ------- | ------- | ------------------------------------------------ |
| `event`   | string  | required | Event to trigger on (see below)                 |
| `command` | string  | required | Shell command to run (supports variables)       |
| `context` | string  | -       | Context for pattern matching (tool events only) |
| `pattern` | string  | -       | Regex pattern to match against context          |
| `cwd`     | string  | cwd     | Working directory for command                   |
| `timeout` | number  | 30000   | Timeout in milliseconds                         |
| `notify`  | boolean | true    | Whether to show output notification             |

### Variable Substitution

Commands support variable substitution:

| Variable | Description | Available In |
|----------|-------------|--------------|
| `${file}` | Path to the file being operated on | `tool_call`, `tool_result` |
| `${tool}` | Name of the tool being called | `tool_call`, `tool_result` |
| `${cwd}` | Current working directory | All events |

### Supported Events

| Event             | Description                        | Context Available |
| ----------------- | ---------------------------------- | ----------------- |
| `session_start`   | When a new session starts          | No                |
| `session_shutdown`| When a session is shutting down    | No                |
| `tool_call`       | Before a tool is executed          | Yes               |
| `tool_result`     | After a tool finishes execution    | Yes               |
| `agent_start`     | When the agent starts processing   | No                |
| `agent_end`       | When the agent finishes processing | No                |
| `turn_start`      | When a turn starts                 | No                |
| `turn_end`        | When a turn ends                   | No                |

### Context Types (for tool events)

| Context     | Description                              | Applies To          |
| ----------- | ---------------------------------------- | ------------------- |
| `tool_name` | Match against the tool name              | tool_call, tool_result |
| `file_name` | Match against file paths in tool input   | read, edit, write   |
| `command`   | Match against bash commands              | bash                |

## Examples

### Format files with Biome after write/edit

```json
{
  "group": "biome-format",
  "pattern": "biome.json",
  "hooks": [
    {
      "event": "tool_result",
      "context": "tool_name",
      "pattern": "^(write|edit)$",
      "command": "biome format --write \"${file}\" 2>/dev/null || true",
      "timeout": 5000,
      "notify": false
    }
  ]
}
```

### Run TypeScript type checking after agent ends

```json
{
  "group": "typescript",
  "pattern": "tsconfig.json",
  "hooks": [
    {
      "event": "agent_end",
      "command": "tsc --noEmit"
    }
  ]
}
```

### Run ESLint on specific file after editing

```json
{
  "group": "eslint-on-edit",
  "pattern": "eslint.config.*",
  "hooks": [
    {
      "event": "tool_result",
      "context": "file_name",
      "pattern": "\\.(js|ts|jsx|tsx)$",
      "command": "eslint --fix \"${file}\""
    }
  ]
}
```

### Run tests after editing test files

```json
{
  "group": "vitest",
  "pattern": "vitest.config.*",
  "hooks": [
    {
      "event": "tool_result",
      "context": "file_name",
      "pattern": "\\.test\\.tsx?$",
      "command": "vitest run --reporter=dot \"${file}\""
    }
  ]
}
```

### Send desktop notification after agent ends

```json
{
  "group": "notify",
  "pattern": "*",
  "hooks": [
    {
      "event": "agent_end",
      "command": "notify-send 'Pi' 'Agent finished'"
    }
  ]
}
```

### Silent formatting (no notifications)

```json
{
  "group": "prettier-silent",
  "pattern": ".prettierrc*",
  "hooks": [
    {
      "event": "tool_result",
      "context": "tool_name",
      "pattern": "^(write|edit)$",
      "command": "prettier --write \"${file}\" 2>/dev/null || true",
      "notify": false
    }
  ]
}
```

## Commands

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `/hooks-reload` | Reload hooks configuration from disk |
| `/hooks-list`   | List all configured hooks            |

## Configuration Files

- **Extension defaults**: `defaults.json` (used when no global config exists)
- **Global settings**: `~/.pi/agent/settings.json` under key `"hooks"`

Global settings take precedence over extension defaults.

## Migration from Biome/LSP Extensions

This extension can replace:

1. **Biome extension**: Use the `biome-format` group (included by default)
2. **LSP diagnostics hook**: Use `typescript-typecheck`, `eslint-check`, `pyright-check`, or `ruff-check` groups

Note: This extension does **not** replace LSP tools (definition, references, hover, etc.). Those require the full LSP extension.
