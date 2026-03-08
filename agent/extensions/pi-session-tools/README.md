# pi-session-tools

Inspection tools for Pi session JSONL logs in `~/.pi/agent/sessions`.

## Tools

- `pi-list-projects` — list known session projects (count, size, last activity)
- `pi-list-sessions` — list sessions for a project
- `pi-session-events` — search user prompts + user shell commands over time
- `pi-tool-calls` — aggregate tool invocation stats (including error-only mode)
- `pi-read-session` — paginated message reader with role/query filters

## Project/session resolution

Project arguments accept:

- encoded dir ID
- decoded path
- cwd path
- partial match

Session arguments accept:

- exact filename
- partial filename
- numeric index (`0` = most recent)

## Implementation details

- Reads JSONL directly, no external DB.
- Uses fuzzy filtering for query fields.
- Provides text tables plus structured result payloads.
- Handles malformed lines defensively (skips invalid entries).
