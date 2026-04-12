---
name: pi-prompt-authoring
description: "Authors system prompt additions for pi coding agent. Use when extending pi's default prompt with custom principles, guidelines, or project-specific rules via SYSTEM.md or APPEND_SYSTEM.md."
---

# Pi Prompt Authoring

Authors custom system prompt additions for pi coding agent. Pi provides a default system prompt with identity, tools, and guidelines. This skill covers what to add via `SYSTEM.md` (replace default) or `APPEND_SYSTEM.md` (extend default).

## How Pi's System Prompt Works

Pi builds the system prompt dynamically at runtime. The construction follows this order:

### Default System Prompt Structure

When using the default prompt, pi constructs it with these sections:

1. **Identity statement** - "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files."
2. **Available tools** - List of enabled tools with one-line descriptions
3. **Guidelines** - Context-aware guidelines based on which tools are available
4. **Pi documentation references** - Paths to README, docs, and examples
5. **Append system prompt** - Content from `APPEND_SYSTEM.md` or `--append-system-prompt`
6. **Project context** - Loaded `AGENTS.md`/`CLAUDE.md` files
7. **Skills section** - XML-formatted list of available skills (only if `read` tool is enabled)
8. **Metadata** - Current date and working directory (always last)

### Tool Listing

Tools appear in the system prompt only when a one-line description snippet is provided. Default tools are `read`, `bash`, `edit`, `write`. The format is:

```
Available tools:
- read: Read the contents of a file
- bash: Execute a bash command in the current working directory
- edit: Edit a single file using exact text replacement
- write: Write content to a file
```

Custom tools from extensions can also be included if the extension provides a snippet. If no tools have snippets, the prompt shows "(none)".

### Guidelines

Guidelines are context-aware based on available tools:

- If `bash` is available without `grep`/`find`/`ls`: "Use bash for file operations like ls, rg, find"
- If `bash` is available with `grep`/`find`/`ls`: "Prefer grep/find/ls tools over bash for file exploration (faster, respects .gitignore)"
- Always included: "Be concise in your responses" and "Show file paths clearly when working with files"

Custom guidelines can be added via extensions and appear before the default guidelines.

### Skills Section Format

At startup, pi scans skill locations and extracts names, descriptions, and file paths. The system prompt includes visible skills in XML format per the [Agent Skills specification](https://agentskills.io/integrate-skills):

```

The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory (parent of SKILL.md / dirname of the path) and use that absolute path in tool commands.

<available_skills>
  <skill>
    <name>skill-name</name>
    <description>What this skill does and when to use it</description>
    <location>/absolute/path/to/skill/SKILL.md</location>
  </skill>
</available_skills>
```

This is progressive disclosure: only the skill list is always in context; full skill instructions load on-demand when the agent uses `read` to load the `SKILL.md` file. Skills with `disable-model-invocation: true` in frontmatter are excluded from the prompt and can only be invoked via `/skill:name` commands.

### Context File Loading Order

Pi loads `AGENTS.md` (or `CLAUDE.md`, in that priority order) from:

1. `~/.pi/agent/AGENTS.md` (global, loaded first)
2. Parent directories walking up from cwd to filesystem root
3. Current directory (loaded last)

All matching files are concatenated in this order with headers:

```
# Project Context

Project-specific instructions and guidelines:

## /path/to/AGENTS.md

[content]
```

If both `AGENTS.md` and `CLAUDE.md` exist in the same directory, only `AGENTS.md` is used.

### Custom System Prompt Behavior

**`SYSTEM.md` or `--system-prompt` (replaces default):**

- Your custom prompt becomes the base
- `APPEND_SYSTEM.md` or `--append-system-prompt` is still appended
- Context files (`AGENTS.md`/`CLAUDE.md`) are appended after
- Skills section is appended if `read` tool is available
- Date and working directory are always added last

**`APPEND_SYSTEM.md` or `--append-system-prompt` (extends default):**

- Appended to the default system prompt after documentation references
- Before context files and skills section

### Custom System Prompt Locations

- **Project**: `.pi/SYSTEM.md` or `.pi/APPEND_SYSTEM.md`
- **Global**: `~/.pi/agent/SYSTEM.md` or `~/.pi/agent/APPEND_SYSTEM.md`
- **CLI**: `--system-prompt <text>` (replaces) or `--append-system-prompt <text>` (extends)

Project files take precedence over global files. CLI flags override file-based discovery.

**Key principle**: Don't duplicate what pi already provides. Focus your custom prompt on **additional principles and constraints** specific to your workflow.

## Section 1: Core Principles (Optional)

**Purpose**: Define coding standards, code quality expectations, and architectural preferences. Pi's default is minimal; add principles for your workflow.

**Common principle categories**:

- **Simplicity**: Prefer simple solutions, abstraction is earned
- **Code quality**: No AI-generated debt, same standards as human code
- **Codebase health**: Delete dead code, fix issues on contact
- **Working code**: Finish what works, don't rewrite unnecessarily
- **Build & verification**: Code must build/lint/typecheck before shipping
- **Security**: Validate input, never log secrets, use allowlists

**Example**:

```
<simplicity>
The assistant uses the simplest code that solves the problem. Abstraction is earned.
</simplicity>

<codebase_health>
Every change must leave the codebase healthier. Delete dead code.
</codebase_health>
```

## Section 2: Behavioral Guidelines (Optional)

**Purpose**: Enforce specific behaviors beyond pi's defaults. Define how the agent should approach tasks, handle errors, and interact with users.

**Common guideline categories**:

- **Debugging**: Fix causes not symptoms, read implementation before changing
- **Architecture**: Dependencies flow one direction, interfaces belong to consumers
- **Testing**: Tests verify what code does, each test must earn its place
- **Scope**: One change does one thing, explicit permission boundaries
- **Error handling**: Fail fast, no fallback defaults masking errors
- **Documentation**: Read docs before configuring, use upstream examples
- **User directives**: User corrections are permanent facts, repeated requests mean failure

**Example**:

```
<debugging_and_fixes>
Fix the cause, not the symptom. Read the implementation, trace the box model,
understand the pixels, then change one thing with certainty.
</debugging_and_fixes>

<scope>
One change does one thing. No unrequested features, no undiscussed removals.
</scope>
```

## Section 3: Custom Tool Usage Guidelines (Optional)

**Purpose**: Add usage patterns for custom tools registered via pi extensions. Pi auto-generates tool descriptions for built-in tools; only add guidelines for extension-specific tools.

**Example for custom display tool**:

```
<display_requirements>
The display must show what you are doing. Update at phase changes.
Use genui tool with openui-lang source for display updates.
</display_requirements>

<genui_tool>
Use Canvas with Header, Col, and Timestamp. Header includes icon, title, subtitle.
Icons by phase: sync for running, check for done, bug for error.
</genui_tool>
```

## Section 4: Project-Specific Context (Optional)

**Purpose**: Add project-specific conventions, commands, or constraints. Pi already loads AGENTS.md/CLAUDE.md files; use APPEND_SYSTEM.md for rules that don't fit there.

**Example**:

```
<project_context>
The project uses Nix flakes. Always use `nix develop` for shell access.
Build with `nix build`. Tests run via `nix flake check`.
</project_context>
```

## Architectural Patterns

**Use APPEND_SYSTEM.md for extensions**: Don't replace pi's default unless necessary. Append custom principles to preserve built-in functionality.

**Use SYSTEM.md for replacements**: Only if you need to fundamentally change pi's behavior.

**XML tags for organization**: Use `<section_name>` tags to organize principles logically.

**Concise, value-based rules**: "Scope is sacred" not "When asked to do X, only touch files that Y".

**No procedural details**: Avoid code snippets, variable names, or step-by-step scenarios.

## Validation Checklist

Before finalizing:

- [ ] No duplication of pi's default (identity, date, tools, skills)
- [ ] Principles are concise and value-based, not procedural
- [ ] XML tags used for logical organization
- [ ] No code snippets or variable names in principles
- [ ] Custom tool guidelines only for extension-specific tools
- [ ] Project context only for non-obvious conventions
- [ ] File placed correctly: `SYSTEM.md` (replace) or `APPEND_SYSTEM.md` (extend)
- [ ] **No political, ethical, or moral points** — these are not relevant and should not be in system prompts
- [ ] Focus on agent accountability and factuality — these are the only behavioral values that belong in system prompts
