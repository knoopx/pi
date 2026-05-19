---
name: notify
description: "Inform the user what is happening — skip passive lookups"
token_cost: 1
keywords: ["inform", "progress", "status"]
---

## Inform the user

Keep the user informed of what the agent is doing.

REQUIRED: message (one-line text)

## When to notify

Every step that produces effects. Editing code, running builds, checking output, fixing errors — always notify. Pure reads (find, read, ls, grep) are passive lookups and do not warrant notification.

- Before every mutating tool call (edit, bash with side effects, write)
- After every tool call that changes state or produces output worth surfacing
- On errors and unexpected output
- On completion

## Message format

- **message**: One-line text describing the action. Max 70 chars.
- Never include IDs, codes, hashes, filenames, or specific references — keep it high-level.

```tool
{"name": "notify", "input": {"message": "Running test suite"}}
```

## Workflow examples

### Implementation task

1. `notify("Editing config file")` — before editing
2. `notify("Running typecheck")` — before running
3. `notify("Typecheck passed")` — after results
4. `notify("Done!")` — on completion

### Research task

1. `notify("Starting research")` — before web searches begin
2. `notify("Done, writing answer")` — when transitioning to output

### Debugging session

1. `notify("Investigating the issue")` — at start
2. `notify("Found the cause, applying fix")` — on breakthrough
3. `notify("Fix verified, done!")` — on completion

## Best practices

- Skip notifications for passive lookups (find, read, ls, grep)
- Notify before mutations and after state-changing results
- Keep messages short and specific
