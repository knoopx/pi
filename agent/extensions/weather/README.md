# weather

Current weather + short forecast integration.

## Tool

- `weather`
  - Optional inputs: `latitude`, `longitude`, `units` (`c` or `f`)
  - Without coordinates, falls back to IP-based location
  - Returns current conditions and hourly forecast in table form

## Command

- `/weather`
  - Shows a compact weather summary notification in UI

## Implementation notes

- Caches requests for 5 minutes per `(lat,lon,unit)` key
- Tool result includes structured `details.weather` payload
- Rendering uses shared helpers from `renderers`
