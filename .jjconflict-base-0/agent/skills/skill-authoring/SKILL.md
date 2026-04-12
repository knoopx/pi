---
name: skill-authoring
description: "Writes effective pi skills with proper structure, concise content, and progressive disclosure. Use when creating new skills, improving existing skills, or reviewing skill quality."
---

# Skill Authoring Best Practices

Create or refactor pi skills following the canonical spec at `agent/skills/pi/references/skills.md`.

## Workflow

1. **Clarify scope**: Define what the skill does and the trigger phrases that load it. Write a one-sentence description starting with a verb (e.g., "Manages containers..." not "A skill for managing containers").
2. **Plan resources**: Decide content placement:
   - **SKILL.md**: Overview, decision points, minimal workflow instructions (target: under 80 lines of body content)
   - **references/**: Deep guides, specs, domain docs read on demand
   - **scripts/**: Deterministic code that should not be rewritten each invocation
   - **assets/**: Templates, logos, files used in outputs
3. **Write the skill**:
   - Add frontmatter with `name` (kebab-case) and `description` (quoted string, starts with verb, includes "Use when..." clause)
   - Write concise instructions with concrete examples — one inline example per key concept
   - Link to references for deep content (one level deep only)
4. **Validate**: Check against the criteria below, then test on a real task

## Frontmatter Requirements

```yaml
---
name: my-skill-name # kebab-case, matches directory name
description: "Performs X by doing Y. Use when Z happens or user asks for W."
---
```

- `name`: Must be kebab-case and match the skill directory name
- `description`: Quoted string. First sentence describes what the skill does (verb-first). Second sentence starts with "Use when" to define trigger conditions.

## Validation Checklist

Before finishing, verify every item:

- [ ] `name` is kebab-case and matches directory name
- [ ] `description` is a quoted string with verb-first sentence + "Use when..." clause
- [ ] No duplicated content between SKILL.md and references
- [ ] Body is under 80 lines (move excess to `references/`)
- [ ] All file links resolve to existing paths
- [ ] At least one concrete inline example (command, code snippet, or config)
- [ ] No explanations of concepts the agent already knows
- [ ] Workflow steps have explicit outputs or validation checkpoints

## Red Flags to Fix

- Duplicate information between SKILL.md and references — deduplicate, keep detail in references
- Long explanations of obvious concepts — delete or move to references
- Extra docs (README, changelog) that the agent will never read — remove
- Description using `>` chevron instead of quoted string — convert to `"quoted"`
- Missing "Use when..." clause in description — add trigger conditions
