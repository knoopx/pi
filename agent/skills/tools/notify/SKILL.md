---
name: notify
description: "Inform the user what is happening — mandatory on every single step, no exceptions."
token_cost: 1
keywords: ["inform", "progress", "status"]
---

## Inform the user

Keep the user informed of what the agent is doing.

REQUIRED: message (one-line text)

## When to notify

Every step. No exceptions. Reading files, editing code, running builds, checking output, fixing errors — always notify.

- Before every tool call that does work (read, edit, bash, find, grep)
- After every tool call returns results
- On errors and unexpected output
- On completion

## Message format

- **message**: One-line text describing the action. Max 70 chars.

```tool
{"name": "notify", "input": {"message": "Running test suite — 247 tests"}}
```

## Workflow examples

### Implementation task

1. `notify("Reading index.ts")` — before reading
2. `notify("Editing index.ts to add TTS")` — before editing
3. `notify("Running typecheck")` — before running
4. `notify("Typecheck passed")` — after results
5. `notify("Done!")` — on completion

### Research task

1. `notify("Starting research")` — before web searches begin
2. `notify("Done, writing answer")` — when transitioning to output

### Debugging session

1. `notify("Investigating the issue")` — at start
2. `notify("Found the cause, applying fix")` — on breakthrough
3. `notify("Fix verified, done!")` — on completion

## Best practices

- Notify before every action and after every result
- Keep messages short and specific
- Never skip notifying — every step warrants it
