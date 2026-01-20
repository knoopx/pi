# Pi Coding Agent Configuration

This directory contains the configuration and custom assets for the [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

## Directory Structure

- **`agent/`**: Core configuration and customizations.
  - **`settings.json`**: Global configuration (model, provider, theme, etc.).
  - **`auth.json`**: Authentication credentials.
  - **`extensions/`**: Custom TypeScript extensions that add tools, commands, or modify agent behavior.
  - **`skills/`**: Specialized skill definitions providing extra tools (e.g., `bun`, `nix`, `podman`).
  - **`themes/`**: UI theme definitions.
  - **`sessions/`**: Stored conversation sessions.

## Current Configuration

From `agent/settings.json`:
- **Default Provider**: `github-copilot`
- **Default Model**: `grok-code-fast-1`
- **Permission Level**: `low`
- **Theme**: `custom`

## Installed Extensions

# Pi Coding Agent Configuration

This directory contains the configuration and custom assets for the [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

## Directory Structure

- **`agent/`**: Core configuration and customizations.
  - **`settings.json`**: Global configuration (model, provider, theme, etc.).
  - **`auth.json`**: Authentication credentials.
  - **`extensions/`**: Custom TypeScript extensions that add tools, commands, or modify agent behavior.
  - **`skills/`**: Specialized skill definitions providing extra tools (e.g., `bun`, `nix`, `podman`).
  - **`themes/`**: UI theme definitions.
  - **`sessions/`**: Stored conversation sessions.

## Current Configuration

From `agent/settings.json`:
- **Default Provider**: `github-copilot`
- **Default Model**: `grok-code-fast-1`
- **Permission Level**: `low`
- **Theme**: `custom`

## Installed Extensions

- **`ast-grep`**: AST-based code search and replace operations.
- **`browser`**: Web automation and scraping capabilities.
- **`cheatsh`**: Command-line examples and reference sheets from cheat.sh.
- **`codemapper`**: Code structure analysis and navigation.
- **`exa-search`**: Web search capabilities via Exa.
- **`github`**: GitHub repository and user information tools.
- **`init`**: Command to initialize `AGENTS.md` for project context.
- **`jujutsu`**: Version control integration with Jujutsu.
- **`markitdown`**: File conversion to Markdown.
- **`nix`**: Nix package and option search tools.
- **`no-cowboys-in-this-town`**: Enforces code analysis before file modifications.
- **`npm`**: NPM package information and management.
- **`pip`**: Python package management tools.
- **`provider-status-bar`**: AI provider usage statistics and status bar.
- **`reverse-history-search`**: Enhanced command history search.
- **`sessions`**: Session management tools.
- **`toon`**: JSON to Toon format conversion.

## Available Skills

The agent is equipped with several powerful CLI-based skills:
- **Data & Query**: `jc`
- **Development & DevOps**: `ast-grep`, `bun`, `jscpd`, `jujutsu`, `knip`, `nh`, `nix`, `nix-flakes`, `nu-shell`, `podman`, `python`, `scraping`, `typescript`, `uv`, `vitest`
- **Media Processing**: `yt-dlp`
- **Package Management**: `jujutsu-auto-describe`, `vicinae`

## Custom Commands

You can use these custom commands defined in the extensions:
- `/init`: Analyze codebase and create `AGENTS.md`.
- `/jujutsu-disable-hooks`: Disable automatic Jujutsu hooks for change management.
- `/jujutsu-enable-hooks`: Enable automatic Jujutsu hooks for change management.
- `/redo`: Redo the last undo operation.
- `/sessions`: Session management tools.
- `/undo`: Revert to the previous user message and restore the repository state.
- `/usage`: Show AI provider usage statistics.
