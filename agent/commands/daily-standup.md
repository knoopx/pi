---
description: Prepare daily standup from Pi sessions, Linear, and GitHub
args:
  project:
    description: Project filter (partial match)
---

Prepare my daily standup update.

Project filter: $project

## Workflow

1. Get Pi session events using `pi-session-events` for the last 24 hours, filter by project if specified
2. Get Linear issues using `linear-search` with `assignedToMe: true`
3. Get GitHub PRs: `gh pr list --author @me --state all --limit 10`
4. Deduplicate across sources

## Output Format

```markdown
## Yesterday

- Action verb + outcome (max 10 bullets)

## Today

- Concrete next actions (max 10 bullets)

## Blockers

- None (or list blockers)
```

## Style

- Start with: Fixed, Implemented, Continued, Completed, Merged
- Include issue IDs: "Completed SLNG-648: Remove hathora models"
- Past tense for Yesterday, future for Today
