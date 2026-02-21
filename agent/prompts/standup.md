---
description: Generate daily standup update from session activity and commits
---

Prepare my daily standup update.

<workflow>
1. Get yesterday's session events using `pi-session-events` (last 24 hours)
2. Get recent commits using `jj log`
3. Identify completed work and next actions
4. Format for quick sharing
</workflow>

<tools>
```bash
# Yesterday's session activity
pi-session-events --from "$(date -d 'yesterday' --iso-8601)T00:00:00" --limit 50

# Recent commits (last 24h)

jj log --no-graph -r 'mine() & committer_date(after:"yesterday")' -T 'description ++ "\n"' --ignore-working-copy

# Current working changes

jj status --ignore-working-copy

```
</tools>

<output-format>
## Standup: [Today's Date]

### Yesterday
- [Completed task - action verb + outcome]
- [Completed task - be specific and concise]

### Today
- [Planned task - concrete next action]
- [Planned task - what you'll actually work on]

### Blockers
- None *(or list specific blockers)*
</output-format>

<guidelines>
- **Action verbs**: Built, Fixed, Added, Refactored, Implemented
- **Be specific**: "Added DeepWiki integration" not "Worked on features"
- **Max 5 items** per section - focus on highlights
- **No jargon**: Readable by teammates unfamiliar with details
- **Blockers**: Only real blockers, not minor friction
</guidelines>
```
