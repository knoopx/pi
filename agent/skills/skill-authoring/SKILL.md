---
name: skill-authoring
description: "Creates pi skills that teach the agent how to perform one or more use cases within a single domain. Use when creating or improving a pi skill."
---

# Pi Skills

Skills are Markdown files (`SKILL.md`) that teach the agent how to do something it doesn't know by default. Each skill covers one or more use cases within a single domain — e.g., "NixOS configuration management" with sub-areas for system updates, home manager, and package search. The agent loads the full file when the user's request matches the trigger description.

## File Layout

```
my-skill/
├── SKILL.md              # Frontmatter + workflow instructions (keep under 120 lines)
├── references/           # Deep docs loaded on demand (API specs, advanced patterns)
└── scripts/              # Helper scripts the agent runs directly
```

Assets go in `assets/` for templates and files the agent uses in outputs. Scripts in `scripts/` are deterministic code — not rewritten each invocation.

## Frontmatter

```yaml
---
name: my-skill-name # kebab-case, matches directory name exactly (max 64 chars)
description: "Extracts text from PDF files using pdf-parse. Use when working with PDF documents."
---
```

- `name`: lowercase letters, numbers, hyphens only. No leading/trailing hyphens, no consecutive hyphens.
- `description`: a quoted string with two sentences. First starts with a verb and describes what the skill does. Second starts with "Use when" to define trigger conditions.

## Body Structure (under 120 lines)

```markdown
# Skill Name

One-line summary of the domain this skill covers.

## Workflow / Commands

Step-by-step examples or command reference with inline code snippets.

## Details

Common variations, edge cases, or tricky parts specific to this domain.

## Constraints / Best Practices

Rules, gotchas, and things the agent must do (or not do).

See [deep reference](references/DEEP.md) for API specs and advanced usage.
```

- **Workflow/Commands**: numbered steps with concrete inline examples — command, code snippet, or config.
- **Details**: short context for variations on the main use cases.
- Link to `references/` for anything deep. One level of linking only.

## Examples from Existing Skills

**Good — focused domain, multiple use cases:**

```yaml
# nh: one domain (Nix operations), three sub-domains (system updates, home manager, package search)
description: "Switches NixOS/Home Manager configurations, cleans old generations, and performs system maintenance. Use when running os/home switch, pruning the Nix store, or managing system generations."
```

**Good — single use case within a domain:**

```yaml
# transcribe-audio: one domain (audio transcription), one primary use case
description: "Transcribes audio files to text using whisper-cpp. Use when converting speech to text, transcribing podcasts, lectures, or meetings."
```

## Validation Checklist

- [ ] `name` is kebab-case and matches the directory name exactly
- [ ] `description` is a quoted string with verb-first sentence + "Use when..." clause
- [ ] Body is under 120 lines (move excess to `references/`)
- [ ] At least one concrete inline example per key concept
- [ ] No duplicated content between SKILL.md and references
- [ ] All file links resolve to existing paths
- [ ] Workflow steps have explicit outputs or validation checkpoints

## Common Mistakes

- Description uses `>` chevron instead of `"quoted"` — convert to quoted string
- Missing "Use when..." clause — add trigger conditions
- Duplicate content between SKILL.md and references — keep detail only in references
- Long explanations of concepts the agent already knows — delete them
- Extra files the agent never reads (README, changelog) — remove them
