---
name: skill-authoring
topic: Pi Skill Authoring
description: "Create SKILL.md files that teach the agent new domains. Use when authoring a new pi skill with frontmatter, body structure, and references."
token_cost: 200
keywords: ["skill", "author", "create", "improve", "domain"]
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

Every skill requires `name`, `description`, and `keywords`. Additional fields depend on the skill type.

### Required Fields

```yaml
---
name: my-skill-name # kebab-case, matches directory name (max 64 chars)
description: "Does X. Use when Y."
keywords: ["keyword1", "keyword2", "keyword3"]
---
```

- `name`: lowercase letters, numbers, hyphens only. No leading/trailing hyphens.
- `description`: quoted string. First sentence starts with a verb. Second starts with "Use when".
- `keywords`: array of single lowercase words used for scoring. Each word match scores 1.0 — you need at least 2 matches (score >= 2.0) for injection. Pick words users actually type. Avoid sharing keywords with other skills.

### Optional Fields by Type

**Tool skills** (in `tools/` directory, name = tool name):

```yaml
related: [other-skill] # co-inject related skills
```

**Knowledge skills** (domain knowledge):

```yaml
topic: State-Space Search # required — display heading in injected block
token_cost: 120 # estimated token budget (default: 150)
requires_tools: [read, find] # tools needed before this skill fires
```

**Protocol skills** (behavioral rules):

```yaml
topic: Conventional Commits # required — display heading in injected block
```

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
- [ ] `keywords` are single lowercase words, at least 3 per skill
- [ ] `topic` present for knowledge and protocol skills
- [ ] `related` lists logically connected skills for co-injection
- [ ] Body is under 120 lines (move excess to `references/`)
- [ ] At least one concrete inline example per key concept
- [ ] No duplicated content between SKILL.md and references
- [ ] All file links resolve to existing paths
- [ ] Keywords don't collide with other skills

## Common Mistakes

- Description uses `>` chevron instead of `"quoted"` — convert to quoted string
- Missing "Use when..." clause — add trigger conditions
- Duplicate content between SKILL.md and references — keep detail only in references
- Long explanations of concepts the agent already knows — delete them
- Extra files the agent never reads (README, changelog) — remove them
