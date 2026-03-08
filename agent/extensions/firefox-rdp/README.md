# firefox-rdp

Firefox DevTools Remote Debugging Protocol automation.

## Lifecycle

1. `launch-browser` starts a dedicated Firefox profile with `-start-debugger-server 9222`.
2. Use tab/DOM/eval/screenshot tools.
3. `close-browser` kills the spawned process and clears actor caches.

## Tool groups

- Session: `launch-browser`, `close-browser`
- Tabs: `list-browser-tabs`, `navigate-tab`, `reload-tab`, `close-tab`
- JS/DOM: `eval-js-in-tab`, `query-dom`
- Capture: `screenshot-tab`, `screenshot-element`

## Implementation details

- Uses a custom RDP socket client (message framing + actor routing).
- Maintains per-tab actor cache for faster repeated evals.
- Auto-reconnect logic in `listTabs()` if RDP state drops.
- Screenshot capture uses `drawSnapshot` in chrome context.

## Caveats

- Requires `firefox-esr` binary on PATH.
- Uses fixed debug port `9222`.
- This extension kills existing debugger Firefox instances before launch.
