# rodalies

Catalonia Rodalies departures integration.

## Data source

- Stations + departures from `serveisgrs.rodalies.gencat.cat` API.
- Station list cached in-memory for 24 hours.
- Cache is warmed on `session_start`.

## Tool

### `rodalies-departures`

Inputs:

- `stationId?`
- `stationName?`

Resolution strategy for `stationName`:

1. exact case-insensitive
2. substring match
3. fuzzy fallback

Returns next departures (up to 10), sorted by departure time.

## Command

### `/rodalies`

- Opens station picker (`SelectList`).
- Fetches departures for selected station.
- Sends UI notifications per departure line.

## Output fields

- departure time
- line
- destination
- platform
- delay/cancel status
