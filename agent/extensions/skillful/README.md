# Skillfull

Manages skill discovery, system prompt building, and tool gating.

## How it works

Skillfull loads all SKILL.md files from known directories, builds a dynamic system prompt listing available tools and skills, and enforces a tool gate that blocks tool calls until the corresponding skill has been read in the current session.

## Entry point (`index.ts`)

Three pi lifecycle events:

- `tool_call` — detects when the agent reads a `SKILL.md` file via the `read` tool (marks it as consumed), and blocks tool calls whose skill hasn't been read yet
- `session_start` — resets the session tracker
- `before_agent_start` — builds the dynamic system prompt with tools and skills sections

## Modules

| Module                         | Responsibility                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `lib/skills-registry.ts`       | Scans skill directories, parses SKILL.md files, builds keyword index. Singleton `registry`.                           |
| `lib/skill-frontmatter.ts`     | Splits `---` delimiters, parses YAML frontmatter into `{ frontmatter, body }`.                                        |
| `lib/system-prompt-builder.ts` | Formats tools and skills sections for the system prompt.                                                              |
| `lib/session-tracker.ts`       | Tracks read skill names per session. Parses `read` tool paths to detect skill consumption. Resets on `session_start`. |
| `lib/tool-gate.ts`             | Blocks tool calls when the matching tool skill has not been read yet.                                                 |

## Directory resolution

Skills loaded from three locations:

1. **Built-in**: `agent/skills/{tools,knowledge,protocols}/` relative to repo root
2. **User**: `~/.pi/agent/skills/` (flat, no subdirectory type distinction)
3. **Project-local**: `.pi/skills/` relative to repo root

Each skill lives in its own directory with a single `SKILL.md` entrypoint.

## Testing

- `lib/*.test.ts` — unit tests per module

Run: `bun test`
