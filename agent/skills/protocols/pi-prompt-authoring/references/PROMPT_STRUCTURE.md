# Pi Prompt Structure (Detailed)

## Default System Prompt Construction Order

1. **Identity statement** - "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files."
2. **Available tools** - List of enabled tools with one-line descriptions
3. **Guidelines** - Context-aware guidelines based on which tools are available
4. **Pi documentation references** - Paths to README, docs, and examples
5. **Append system prompt** - Content from `APPEND_SYSTEM.md` or `--append-system-prompt`
6. **Project context** - Loaded `AGENTS.md`/`CLAUDE.md` files
7. **Skills section** - XML-formatted list of available skills (only if `read` tool is enabled)
8. **Metadata** - Current date and working directory (always last)

## Tool Listing

Tools appear in the system prompt only when a one-line description snippet is provided. Default tools are `read`, `bash`, `edit`, `write`.

```
Available tools:
- read: Read the contents of a file
- bash: Execute a bash command in the current working directory
- edit: Edit a single file using exact text replacement
- write: Write content to a file
```

Custom tools from extensions can also be included if the extension provides a snippet. If no tools have snippets, the prompt shows "(none)".

## Guidelines

Guidelines are context-aware based on available tools:

- If `bash` is available without `grep`/`find`/`ls`: "Use bash for file operations like ls, rg, find"
- If `bash` is available with `grep`/`find`/`ls`: "Prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)"
- Always included: "Be concise in your responses" and "Show file paths clearly when working with files"

Custom guidelines can be added via extensions and appear before the default guidelines.

## Skills Section Format

Skills appear in XML format per the [Agent Skills specification](https://agentskills.io/integrate-skills):

```xml
<available_skills>
  <skill>
    <name>skill-name</name>
    <description>What this skill does and when to use it</description>
    <location>/absolute/path/to/skill/SKILL.md</location>
  </skill>
</available_skills>
```

Progressive disclosure: only the skill list is always in context; full skill instructions load on-demand. Skills with `disable-model-invocation: true` are excluded from the prompt.

## Context File Loading Order

Pi loads `AGENTS.md` (or `CLAUDE.md`) from:

1. `~/.pi/agent/AGENTS.md` (global, loaded first)
2. Parent directories walking up from cwd to filesystem root
3. Current directory (loaded last)

All matching files are concatenated with headers. If both `AGENTS.md` and `CLAUDE.md` exist in the same directory, only `AGENTS.md` is used.

## Custom System Prompt Behavior

**`SYSTEM.md` or `--system-prompt` (replaces default):**
- Your custom prompt becomes the base
- `APPEND_SYSTEM.md` is still appended
- Context files, skills, and metadata are appended after

**`APPEND_SYSTEM.md` or `--append-system-prompt` (extends default):**
- Appended after documentation references
- Before context files and skills section

## Custom System Prompt Locations

- **Project**: `.pi/SYSTEM.md` or `.pi/APPEND_SYSTEM.md`
- **Global**: `~/.pi/agent/SYSTEM.md` or `~/.pi/agent/APPEND_SYSTEM.md`
- **CLI**: `--system-prompt <text>` (replaces) or `--append-system-prompt <text>` (extends)

Project files take precedence over global files. CLI flags override file-based discovery.
