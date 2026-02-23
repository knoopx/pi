---
name: daily-standup
description: Generates daily standup updates from session activity and commits. Use when preparing standups, reviewing daily progress, or aggregating work across projects.
---

# Daily Standup

Generate standup updates for SLNG projects from Pi sessions and jj commits.

## Usage

```bash
# Default: yesterday's activity
nu ~/.pi/agent/skills/daily-standup/slng-activity.nu

# Custom date range
nu ~/.pi/agent/skills/daily-standup/slng-activity.nu --since "3 days ago"
nu ~/.pi/agent/skills/daily-standup/slng-activity.nu --since "2026-02-20"

# JSON output
nu ~/.pi/agent/skills/daily-standup/slng-activity.nu --format json
```

## Scope

**SLNG projects only** (`~/Projects/slng/*`). Do NOT include activity from other projects.

## Output Format

```markdown
## Standup: [Today's Date]

### Yesterday

- [Action verb + outcome] - be specific and concise

### Today

- [Concrete next action] - what you'll actually work on

### Blockers

- None _(or list specific blockers)_
```

## Guidelines

| Rule          | Example                                             |
| ------------- | --------------------------------------------------- |
| Action verbs  | Built, Fixed, Added, Refactored, Implemented        |
| Be specific   | "Added Soniox STT support" not "Worked on features" |
| Max 5 items   | Focus on highlights per section                     |
| No jargon     | Readable by teammates unfamiliar with details       |
| Real blockers | Only actual blockers, not minor friction            |

## Related Skills

- **jujutsu**: Commit history and revsets
- **self-reflect**: Session reflection and learnings
