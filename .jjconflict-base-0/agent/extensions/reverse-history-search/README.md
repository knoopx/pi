# Reverse History Search Extension

Provides Ctrl+R reverse history search functionality for pi, allowing fuzzy search through user messages and commands across all sessions.

## Features

- **Ctrl+R Shortcut**: Open reverse history search interface
- **Fuzzy Matching**: Type to filter through history entries
- **Multi-Type Search**: Searches both user messages and bash commands
- **Session Persistence**: Loads history from all session files
- **Interactive Navigation**: Use arrow keys to navigate, Enter to select, Escape to cancel

## Usage

### Opening Search

- Press `Ctrl+R` in pi to open the reverse history search interface

### Navigation

- **Up/Down arrows**: Navigate through filtered results
- **Enter**: Insert selected item into the editor
- **Escape**: Cancel and close search
- **Typing**: Fuzzy filter results in real-time
- **Backspace/Delete**: Remove characters from search query

### Result Types

- **$**: Bash commands (prefixed with `!` when inserted)
- **💬**: User messages (inserted as plain text)

## Installation

No additional installation required. The extension is automatically loaded from the extensions directory.

## Requirements

- Session files must exist in `~/.pi/agent/sessions/`
- History is loaded from JSONL session files
- Supports both `userBashCommand` and `user` message types

## Technical Details

- Loads history from all `.jsonl` files in the sessions directory recursively
- Uses simple fuzzy matching (all query characters must appear in order)
- Deduplicates entries based on content
- Sorts results by timestamp (most recent first)
- Limits display to 10 visible results with scroll indicators
- Truncates long content to first line for display
