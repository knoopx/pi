---
name: pi-prompt-authoring
topic: Pi Prompt Authoring
description: "Author SYSTEM.md or APPEND_SYSTEM.md for pi coding agent. Use when extending the default system prompt with custom principles, guidelines, or project rules."
token_cost: 350
keywords: ["prompt", "system", "guideline", "rule", "principle", "authoring"]
---

# Pi Prompt Authoring

Authors custom system prompt additions for pi coding agent. Pi provides a default system prompt with identity, tools, and guidelines. This skill covers what to add via `SYSTEM.md` (replace default) or `APPEND_SYSTEM.md` (extend default).

## How Pi's System Prompt Works

Pi builds the system prompt dynamically: identity → tools → guidelines → docs → append → context → skills → metadata.

**`SYSTEM.md`** replaces the default. **`APPEND_SYSTEM.md`** extends it.

Locations: `.pi/SYSTEM.md` (project), `~/.pi/agent/SYSTEM.md` (global), or `--system-prompt` (CLI).

See [detailed prompt structure](references/PROMPT_STRUCTURE.md) for full construction order, tool listing, skills format, and context file loading.

## Section 1: Core Principles (Optional)

Define coding standards and architectural preferences. Common categories: simplicity, code quality, codebase health, build verification, security.

See [example principles](references/EXAMPLES.md#core-principles) for working examples.

## Section 2: Behavioral Guidelines (Optional)

Enforce specific behaviors: debugging, architecture, testing, scope, error handling, documentation, user directives.

See [example guidelines](references/EXAMPLES.md#behavioral-guidelines) for working examples.

## Section 3: Custom Tool Usage Guidelines (Optional)

Add usage patterns for custom tools from extensions. Built-in tools are auto-documented.

See [example tool guidelines](references/EXAMPLES.md#custom-tools) for working examples.

## Section 4: Project-Specific Context (Optional)

Add project conventions not covered by AGENTS.md/CLAUDE.md.

See [example project context](references/EXAMPLES.md#project-context) for working examples.

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
