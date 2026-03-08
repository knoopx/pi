# watch

File watcher that turns `!PI` references in your working tree into automatic user messages.

## Command

- `/watch`
- `/watch on`
- `/watch off`

Enables/disables runtime watching for the current session.

## Behavior

- Watches current session `cwd`
- Detects PI references in changed files
- When `!PI` trigger lines are present, sends a synthesized message via `pi.sendUserMessage(...)`
- Shows UI notifications for trigger events and watcher state

## Lifecycle behavior

- Starts when enabled and a session is active
- Pauses on `agent_start` and resumes on `agent_end` to avoid self-trigger loops
- Cleans up watcher resources on `session_shutdown`

## Ignore policy

Uses `DEFAULT_IGNORED_PATTERNS` from `core.ts`.
