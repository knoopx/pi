# greet

Tiny session-start reminder hook.

## Behavior

On `session_start`:

- Checks for `.pi/GREET.md` in the current project root.
- If file exists, sends user message:
  - `Read .pi/GREET.md`
- If missing, does nothing.

## Why this exists

Use it as lightweight per-project onboarding:

- coding conventions
- project-specific gotchas
- startup checklist

## Implementation

- Single hook in `index.ts`.
- Uses `fs/promises.access` to test file presence.
- No tool registrations, no commands.
