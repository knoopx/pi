# Change Orchestration

Enforces sequential edit lifecycle — one active edit at a time.

## Tools

### `begin-edit`

Start a new edit session with a conventional commit message name.

```
begin-edit(name: "feat(auth): add login flow")
```

Registers the edit as the current active change. Subsequent edits must wait until this one is finished.

### `finish-edit`

Mark the current edit session as finished.

```
finish-edit()
```

Runs verification, cleanup, and self-improvement phases. Must be called before starting a new edit.

## Lifecycle

```
begin-edit(name) → work → finish-edit() → repeat
```

Only one edit may be active at a time. Attempting to begin a new edit while one is active will fail.

## Hooks

On `agent_end`, if an active edit exists and the turn was not aborted, sends a reminder message prompting the agent to call `finish-edit()`.

Aborted turns (Ctrl+C) are skipped — no reminder is sent.
