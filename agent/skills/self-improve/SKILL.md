---
name: self-improve
description: Analyzes Pi sessions to discover repeating patterns and tool failures, then improves agent behavior through skills, templates, guardrails, and hooks.
---

# Self-Improve

Analyze Pi sessions to improve agent behavior.

## Goals

| Goal              | Method                           |
| ----------------- | -------------------------------- |
| Pattern Discovery | Find repeating prompts/workflows |
| Failure Analysis  | Identify recurring tool errors   |

## Outputs

| File                                        | Purpose                          |
| ------------------------------------------- | -------------------------------- |
| `agent/skills/<name>/`                      | Multi-step workflows             |
| `agent/prompts/<name>.md`                   | Single prompts with args         |
| `agent/extensions/guardrails/defaults.json` | Block/confirm dangerous patterns |
| `agent/extensions/hooks/defaults.json`      | Auto-format/lint after changes   |
| `AGENTS.md`                                 | Project-specific rules           |
| `agent/APPEND_SYSTEM.md`                    | Universal agent guidelines       |

## Session Tools

### List Projects/Sessions

```
pi-list-projects
pi-list-sessions --project "my-project" --limit 10
```

### Analyze Tool Calls

```
pi-tool-calls
pi-tool-calls --errorsOnly
pi-tool-calls --tool "bash:jj" --days 7
```

### Search Events

```
pi-session-events --days 30 --limit 200
pi-session-events --query "refactor" --days 30
```

### Read Sessions

```
pi-read-session --session 0
pi-read-session --session 0 --role toolResult --query "error"
```

## Workflow

### 1. Gather Data

```
pi-session-events --days 30 --limit 200
pi-tool-calls --errorsOnly --days 7
```

### 2. Identify Patterns

**Repeating prompts:**

- Common verbs: "create", "refactor", "describe", "split"
- Similar structures with variable parts
- Multi-step workflows

**Tool failures:**

- Edit: "Could not find exact text"
- Bash: grep exit 1, jj syntax errors
- Recurring error messages

### 3. Prioritize

| Factor      | High Value                       |
| ----------- | -------------------------------- |
| Frequency   | Appears 3+ times in 30 days      |
| Complexity  | Takes 5+ tool calls              |
| Error-prone | Recurring failures               |
| Repetitive  | Same steps with minor variations |

### 4. Create Improvements

Based on findings, update appropriate files.

## Common Failure Patterns

### Edit Tool

| Pattern           | Fix                                |
| ----------------- | ---------------------------------- |
| "Could not find"  | Read file first, use smaller edits |
| "No changes made" | Verify content differs             |

### Bash Tool

| Pattern                      | Fix                      |
| ---------------------------- | ------------------------ |
| grep exit code 1             | Use `grep ... \|\| true` |
| jj "ambiguous" or "^ is not" | Use `@-` for parent      |

## Output Formats

### Skill

```
agent/skills/<name>/SKILL.md
```

Multi-step workflows with tool sequences.

### Prompt Template

```yaml
---
name: template-name
args:
  param:
    description: Parameter description
    default: "@"
---
Template content with {{param}}
```

### Guardrail

```json
{
  "pattern": "^dangerous-cmd",
  "action": "block",
  "reason": "explanation"
}
```

### Hook

```json
{
  "event": "tool_result",
  "pattern": "\\.ext$",
  "command": "formatter \"${file}\""
}
```

## Related Skills

- **skill-authoring**: Write discovered skills
