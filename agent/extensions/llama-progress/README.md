# Llama Progress

Shows a progress bar while llama.cpp processes prompts via podman-llm.service.

## How It Works

Tails `journalctl -f -u podman-llm.service` and parses log lines for:

- `proxying request to model` — resets progress to 0%
- `progress = X.XX` — updates progress bar (0–100%)

A widget is shown above the prompt input when loading starts, hidden when the assistant message arrives.

## Lifecycle

| Event                       | Action                                |
| --------------------------- | ------------------------------------- |
| `session_start`             | Starts journal watch                  |
| `input`                     | Shows progress widget at 0%           |
| `message_start` (assistant) | Hides widget — prompt processing done |
| `session_shutdown`          | Stops journal watch, cleans up        |

## Requirements

- `podman-llm.service` running locally
- `journalctl` access to the service logs
