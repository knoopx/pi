---
name: self-reflect
description: Reflects on the current session to identify failures, inefficiencies, and improvement opportunities. Use at session end to extract learnings.
---

# Self-Reflect

Reflect on the current session to extract learnings and improvements.

## Goals

| Goal               | Method                           |
| ------------------ | -------------------------------- |
| Failure Analysis   | Review tool errors and retries   |
| Efficiency Review  | Find redundant or wasteful steps |
| Pattern Extraction | Discover reusable workflows      |
| Knowledge Gaps     | Note missing skills or context   |

## What to Look For

### Failures

- Tool calls that errored
- Multiple retries of same action
- User corrections or clarifications
- Misunderstood requirements

### Inefficiencies

- Read file multiple times unnecessarily
- Overly large edits that could be smaller
- Commands that could be combined
- Backtracking on approach

### Patterns

- Multi-step workflows worth automating
- Repeated prompt structures
- Common tool sequences

## Categorize Findings

| Category       | Action                        |
| -------------- | ----------------------------- |
| Tool Misuse    | Update AGENTS.md with pattern |
| Missing Skill  | Create new skill              |
| Repeated Steps | Create prompt template        |
| Edge Case      | Add to skill or guardrail     |

## Output Files

| File                      | Purpose                   |
| ------------------------- | ------------------------- |
| `agent/skills/<name>/`    | Multi-step workflows      |
| `agent/prompts/<name>.md` | Reusable prompt templates |
| `AGENTS.md`               | Project-specific rules    |
| `agent/APPEND_SYSTEM.md`  | Universal agent manifesto |

## APPEND_SYSTEM.md Format

New sections use numbered Roman headings with `Against` or `For` stance (`## N. Against X` or `## N. For X`). Prose paragraphs, no bullet lists, no bold markers, no indented context blocks. Declarative statements in first person. General principles, no project-specific tool names or examples. Read existing sections before adding new ones — match the style exactly.

## Common Issues

### Edit Failures

| Pattern               | Learning                        |
| --------------------- | ------------------------------- |
| "Could not find"      | Always read file before editing |
| Multiple edit retries | Use smaller, targeted edits     |
| Wrong whitespace      | Match exact indentation/quotes  |

### Bash Failures

| Pattern           | Learning                    |
| ----------------- | --------------------------- |
| grep exit 1       | Use `grep ... \|\| true`    |
| Command not found | Check available tools first |
| Permission denied | Note required permissions   |

### Workflow Issues

| Pattern               | Learning                     |
| --------------------- | ---------------------------- |
| Asked same question   | Clarify requirements upfront |
| Backtracked on design | Plan before implementing     |
| Missed edge case      | Add to skill checklist       |

## Reflection Output

```markdown
## Session Summary

**Task:** [What was accomplished]

**Failures:**

- [Tool/approach that failed and why]

**Inefficiencies:**

- [Steps that could be optimized]

**Learnings:**

- [New patterns or knowledge gained]

**Improvements:**

- [ ] [Concrete change to make]
```

## Related Skills

- **self-improve**: Analyze historical sessions for patterns
- **skill-authoring**: Write discovered skills
