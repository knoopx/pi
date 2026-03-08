# home-assistant

Home Assistant entity discovery + control tools.

## Configuration

Run:

- `/home-assistant`

Config is stored in:

- `~/.pi/agent/auth.json` under key `home-assistant`

The command supports:

- test current connection
- reconfigure URL/token
- remove configuration

## Tools

- `ha-list-entities` (filters: `domain`, `pattern`, `state`)
- `ha-get-state`
- `ha-toggle`
- `ha-turn-on` (supports light/climate options)
- `ha-turn-off`
- `ha-call-service` (advanced/custom service calls)

## API behavior

- Uses REST calls to `${url}/api/...` with bearer token auth.
- Returns explicit API error text with status/body on failure.
- Tool outputs are formatted for terminal readability and include structured `details`.

## Notes

- Entity domain is inferred from `entity_id` for on/off/toggle calls.
- `ha-call-service` is the escape hatch for unsupported service shapes.
