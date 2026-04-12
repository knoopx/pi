# notification

Desktop notifications (`notify-send`) with optional TTS mode.

## Tool

### `notify`

Sends a desktop notification.

Supported params:

- `summary` (required)
- `body`
- `urgency`
- `expireTime`
- `appName`
- `icon`
- `category`

## Command

### `/tts [on|off|toggle]`

Controls text-to-speech playback for future notifications.

## Runtime behavior

- If `notify-send` fails, tool returns explicit error + exit details.
- When TTS is enabled, extension:
  - pauses active media players,
  - runs `tts` command,
  - resumes previous players.
