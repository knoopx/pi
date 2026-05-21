# Self-Correction

Detects agent response problems and injects corrective messages to keep the conversation on track.

## What It Detects

- **Empty responses** — no text, no tool calls
- **Hallucinated tools** — tool names not in the known registry
- **Empty tool names** — tool calls with a blank name
- **Malformed arguments** — `_raw` sentinel indicating invalid JSON args
- **Repeated tool calls** — identical call repeated without explanatory text (loop detection)

## How It Works

The extension hooks three events:

- `tool_execution_start` — collects known tool names into a registry
- `session_start` — resets steering state (previous calls, failure count)
- `turn_end` — assesses the agent's response and injects corrections if needed

When an issue is detected, a correction message is sent via `pi.sendUserMessage()` with `deliverAs: "steer"`. The user sees a warning notification in the UI.

## Consecutive Failure Suppression

After `MAX_CONSECUTIVE_CORRECTIONS` (2) consecutive failures, corrections are suppressed to avoid spamming the conversation. A warning notification is still shown indicating suppression. Failures reset on any successful turn.

## Repeated Call Detection

A repeated tool call (same name and identical input) is only flagged when there is no accompanying text. If the agent writes explanatory text alongside the repeated call, it is treated as intentional re-verification (e.g., re-running a linter after formatting).

## Assessment Priority

When multiple issues exist in one response, checks run in this order:

1. Empty response
2. Empty tool name
3. Unknown tool name
4. Malformed arguments
5. Repeated tool call
