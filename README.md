# Pi Coding Agent Configuration

This directory contains the configuration and custom assets for the [pi-coding-agent](https://github.com/mariozechner/pi-coding-agent).

## Directory Structure

- **`agent/`**: Core configuration and customizations.
  - **`settings.json`**: Global configuration (model, provider, theme, etc.).
  - **`auth.json`**: Authentication credentials.
  - **`extensions/`**: Custom TypeScript extensions that add tools, commands, or modify agent behavior.
  - **`skills/`**: Specialized skill definitions providing extra tools (e.g., `ffmpeg`, `jq`, `nix`).
  - **`themes/`**: UI theme definitions.
  - **`sessions/`**: Stored conversation sessions.
- **`permission/`**: Permission management configurations.
- **`sandbox/`**: Default working directory and scratchpad for the agent.

## Current Configuration

From `agent/settings.json`:
- **Default Provider**: `google-antigravity`
- **Default Model**: `gemini-3-flash`
- **Permission Level**: `low`
- **Theme**: `custom`

## Installed Extensions

- **`exa-search.ts`**: Web search capabilities via Exa.
- **`git-checkpoint.ts`**: Version control helpers.
- **`handoff.ts`**: Session transfer and handoff tools.
- **`init.ts`**: Command to initialize `AGENTS.md` for project context.
- **`pirate.ts`**: Toggleable pirate-mode persona (`/pirate`).
- **`ralph-loop/`**: Advanced agentic looping and workflow automation.
- **`lsp/`**: Language Server Protocol integration.

## Available Skills

The agent is equipped with several powerful CLI-based skills:
- **Data & Query**: `jq`, `duckdb`, `dasel`, `jc`
- **Media Processing**: `ffmpeg`, `imagemagick`, `yt-dlp`
- **Development & DevOps**: `ast-grep`, `ruff`, `shfmt`, `nix`, `nix-flakes`, `podman`, `rclone`, `nu-shell`

## Custom Commands

You can use these custom commands defined in the extensions:
- `/init`: Analyze codebase and create `AGENTS.md`.
- `/pirate`: Toggle pirate mode for a more nautical experience.
- `/ralph`: Invoke the Ralph loop for iterative tasks.
- `/tools`: Interactively enable/disable tools.
