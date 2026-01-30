# Configuration Reference

Pi can be configured through settings files. Configuration can be global or project-specific.

## Configuration Files

| Location                    | Scope                         |
| --------------------------- | ----------------------------- |
| `~/.pi/agent/settings.json` | Global (affects all projects) |
| `.pi/settings.json`         | Project (shared with team)    |

## Settings Structure

```json
{
  "defaultMode": "interactive",
  "packages": ["npm:simple-pkg"],
  "extensions": ["/path/to/extension.ts"],
  "skills": ["~/.local/skills/my-skill"],
  "prompts": ["/path/to/prompts"],
  "themes": ["/path/to/themes"],
  "enableSkillCommands": true,
  "customModels": {
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
  },
  "defaultModel": "anthropic/claude-3-5-sonnet"
}
```

## Configuration Keys

| Key                   | Type    | Description                                            |
| --------------------- | ------- | ------------------------------------------------------ |
| `defaultMode`         | string  | `"interactive"`, `"print"`, `"json"`, `"rpc"`, `"sdk"` |
| `packages`            | array   | npm, git, or local package sources                     |
| `extensions`          | array   | Extension files or directories                         |
| `skills`              | array   | Skill locations                                        |
| `prompts`             | array   | Template directories                                   |
| `themes`              | array   | Theme directories                                      |
| `enableSkillCommands` | boolean | Enable `/skill:name` commands                          |
| `customModels`        | object  | Custom provider configuration                          |
| `defaultModel`        | string  | Default model identifier                               |

See [REFERENCE.md](REFERENCE.md) for complete configuration options.

## Configuration Commands

```bash
# Display configuration
pi config

# Edit configuration
pi config --edit

# Export configuration
pi config --export

# Import configuration
pi config --import <file>
```

## Configuration Loading Order

1. Global settings (`~/.pi/agent/settings.json`)
2. Project settings (`.pi/settings.json` - overrides global)
3. Environment variables (`PI_CONFIG_PATH`, `PI_MODE`)
4. Command-line flags (overrides all)

## Configuration Best Practices

- Use project settings for team projects
- Keep configuration minimal
- Add `.pi/settings.json` to version control
- Document important changes
- Don't include API keys - use environment variables

## Configuration Examples

### Minimal Configuration

```json
{
  "packages": ["npm:my-package"]
}
```

### Development Configuration

```json
{
  "defaultMode": "interactive",
  "packages": ["npm:dev-package@dev"],
  "extensions": ["./dev-extensions"],
  "skills": ["./dev-skills"],
  "prompts": ["./dev-prompts"],
  "enableSkillCommands": true
}
```

### Production Configuration

```json
{
  "packages": ["npm:production-package@1.2.3"],
  "extensions": ["/opt/pi/extensions"],
  "skills": ["/opt/pi/skills"],
  "prompts": ["/opt/pi/prompts"],
  "defaultModel": "anthropic/claude-3-5-sonnet"
}
```

## Configuration Security

Don't include API keys in configuration files. Use environment variables:

```json
{
  "customModels": {
    "providers": {
      "anthropic": {
        "apiKey": "$ANTHROPic_API_KEY"
      }
    }
  }
}
```

See [REFERENCE.md](REFERENCE.md) for complete configuration reference.
