# usage

Interactive dashboards built from session logs (`~/.pi/agent/sessions/*.jsonl`).

## Commands

### `/usage`

Provider/model usage dashboard with tabs:

- Today
- This Week
- All Time

Includes:

- sessions
- message count
- cost
- tokens (input/output/cache)

Interaction:

- `Tab` / `Shift+Tab` / `←→` switch period
- `↑↓` select provider
- `Enter` expand/collapse model rows
- `q` close

### `/tool-usage`

Tool call analytics with views:

- By Tool
- By Date
- By Session

Shows totals + quick insights (top tool, avg/session, unique tools).

## Data handling details

- Respects `PI_CODING_AGENT_DIR` if set.
- Deduplicates assistant usage entries with timestamp+token hash.
- Total token metric excludes cache-read double counting.
- Uses cancellable loaders for long scans.
