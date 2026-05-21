# Output Parser

Detects malformed or fenced tool calls in assistant text output and nudges the model back onto native tool calling.

## How It Works

On `turn_end`, scans the assistant's response for:

- Fenced tool call blocks (e.g., ` ```tool ` or `<tool_call>` tags)
- Text-embedded JSON tool call patterns

When detected, logs a notification and queues a follow-up message (`deliverAs: "followUp"`) asking the model to re-issue the calls as native tool calls.

## What It Detects

- **Fenced blocks** — tool calls wrapped in markdown code fences
- **Tag-based calls** — tool calls using `<tool_call>`/`</tool_call>` delimiters
- **Text-embedded JSON** — tool call patterns embedded in prose

## Behavior

Messages that already contain native `toolCall` content parts are skipped — no nudging needed.
