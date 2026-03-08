# turn-stats

Per-turn telemetry and end-of-run aggregate notifications.

## What it tracks

- turn duration
- output tokens
- generated tokens/sec (from streaming delta timing when available)
- per-turn cost
- aggregate totals across the whole agent run

## Notification format

`↓<outputTokens> | <duration> | <tok/s> | <cost>`

Examples:

- `↓1.9K | 36s | 52.3 tok/s | $0.01`
- `↓420 | 9s` (when tok/s or cost unavailable)

## Lifecycle hooks

- `turn_start` / `turn_end` for per-turn stats
- `message_update` for first/last token timestamp
- `agent_start` / `agent_end` for aggregate run stats
- `session_start` / `session_shutdown` reset all counters

## Notes

- Only assistant messages are counted.
- Cost is omitted when effectively zero (`< $0.005`).
