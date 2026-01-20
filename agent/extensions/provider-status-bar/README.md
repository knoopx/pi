# Provider Status Bar Extension

Displays usage statistics for AI providers in the status bar and provides detailed usage information.

## Features

- **Status Bar Integration**: Shows real-time usage statistics in the pi status bar
- **Multiple Providers**: Supports Anthropic Claude, GitHub Copilot, Google Gemini/Antigravity, OpenAI Codex
- **Usage Command**: Interactive command to view detailed usage statistics
- **Automatic Refresh**: Updates usage data every 5 minutes
- **Provider Status**: Shows service status indicators (✅ ⚠️ 🟠 🔴 🔧)

## Supported Providers

### Anthropic Claude
- Shows 5-hour and weekly usage windows
- Displays Sonnet/Opus model usage
- Uses OAuth tokens from pi auth or Claude CLI keychain

### GitHub Copilot
- Shows premium interactions and chat usage
- Displays quota reset times
- Uses GitHub OAuth tokens

### Google Gemini CLI
- Shows Pro and Flash model usage
- Reads from pi auth or ~/.gemini/oauth_creds.json

### Google Antigravity
- Shows Claude, Gemini 3 Pro, and Gemini 3 Flash usage
- Supports token refresh and project-based quotas

### OpenAI Codex
- Shows 3-hour and daily usage windows
- Displays credits balance
- Reads from pi auth or ~/.codex/auth.json

## Installation

No additional installation required. The extension automatically detects configured providers from `~/.pi/agent/auth.json`.

## Usage

### Status Bar
The extension automatically starts when pi launches and shows usage in the status bar:
```
Claude: ✅ 85% | Copilot: ✅ 42/50 | Gemini: ✅ 12%
```

### Usage Command
Run `/usage` to see detailed usage statistics in an interactive popup.

### Configuration
Add authentication credentials to `~/.pi/agent/auth.json`:

```json
{
  "anthropic": { "access": "your_token" },
  "github-copilot": { "refresh": "your_token" },
  "google-gemini-cli": { "access": "your_token" },
  "google-antigravity": { "access": "your_token", "projectId": "your_project" },
  "openai-codex": { "access": "your_token" }
}
```

## Requirements

- Configured authentication for at least one supported provider
- Internet connection for API calls
- For some providers, specific CLI tools or credentials may be needed as fallbacks