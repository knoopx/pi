# notify

Inform the user of what is happening.

## Tool

### `notify`

Send a desktop notification.

Supported params:

- `message` (required)

## Command

### `/tts [on|off]`

Controls text-to-speech playback for future notifications. Without arguments, toggles TTS.

## Runtime behavior

- If `notify-send` fails, tool returns explicit error + exit details.
- When TTS is enabled, extension:
  - pauses active media players,
  - runs `tts` command,
  - resumes previous players.
