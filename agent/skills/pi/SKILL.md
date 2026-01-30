---
name: pi
description: Configures pi coding agent with skills, templates, extensions, packages, and models. Use for composable development workflows, custom agents, and project-specific configurations.
---

# Pi Coding Agent

Composable terminal coding harness with skills, templates, extensions, and packages.

## Core Components

- **Skills**: Directory-based capability packages with instructions and optional tools
- **Templates**: Markdown snippets that expand into full prompts
- **Extensions**: TypeScript modules adding tools, commands, events, and TUI features
- **Packages**: Bundle resources for sharing via npm or git
- **Models**: Configure AI providers via `models.json`

## Loading Locations

| Resource   | Global                      | Project             | Package        |
| ---------- | --------------------------- | ------------------- | -------------- |
| Extensions | `~/.pi/agent/extensions/`   | `.pi/extensions/`   | `package.json` |
| Skills     | `~/.pi/agent/skills/`       | `.pi/skills/`       | `package.json` |
| Templates  | `~/.pi/agent/prompts/`      | `.pi/prompts/`      | `package.json` |
| Settings   | `~/.pi/agent/settings.json` | `.pi/settings.json` | N/A            |

Disable with `--no-extensions`, `--no-skills`, `--no-prompt-templates`.

## Session Management

- `/new` - Create fresh session
- `/resume` - Switch to existing session
- `/tree` - Navigate session tree
- `/export` - Export to HTML
- `/share` - Upload to GitHub gist
- `/compact` - Trigger compaction

## Model Management

- `/model` - Switch models
- `Ctrl+L` - Cycle through favorites
- `Ctrl+P` - Show favorites list

## Four Modes

**Interactive** (default): Full TUI experience
**Print**: Simple text output
**JSON**: Event stream for APIs
**RPC**: JSON-RPC protocol
**SDK**: Embed in applications

```bash
pi --mode json    # JSON mode
pi --mode rpc     # RPC mode
pi --mode sdk     # SDK mode
```

## Project Configuration

### AGENTS.md

Project instructions loaded at startup from `~/.pi/agent/AGENTS.md`, parent directories, and current directory.

### SYSTEM.md

Replace system prompt per-project at `~/.pi/agent/SYSTEM.md`.

### Settings

Configure resources in `~/.pi/agent/settings.json` or `.pi/settings.json`.

## Package Installation

```bash
# Install from npm
pi install npm:@foo/bar@1.2.3

# Install from git
pi install git:github.com/user/repo@v1

# Install to project
pi install -l npm:@foo/bar

# Remove package
pi remove npm:@foo/bar
```

## Model Configuration

Create `~/.pi/agent/models.json` for custom providers:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "models": [
        {
          "id": "llama-3.1-8b",
          "name": "Llama 3.1 8B (Local)",
          "contextWindow": 128000,
          "maxTokens": 32000
        }
      ]
    }
  }
}
```

See [REFERENCE.md](REFERENCE.md) for complete reference.

## Detailed Documentation

- **Skills**: See [SKILL-REFERENCE.md](SKILL-REFERENCE.md)
- **Templates**: See [TEMPLATE-REFERENCE.md](TEMPLATE-REFERENCE.md)
- **Packages**: See [PACKAGES.md](PACKAGES.md)
- **Sessions**: See [SESSION.md](SESSION.md)
- **Configuration**: See [CONFIG.md](CONFIG.md)
