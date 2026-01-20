# Sessions Extension

Browse and restore previous pi sessions from saved session files.

## Features

- **Session Browser**: Lists all saved sessions sorted by most recent first
- **Preview**: Shows first user message from each session as preview
- **Restore**: Allows selecting and restoring a previous session
- **File System Integration**: Recursively scans session directories for JSONL files

## Installation

No additional installation required.

## Usage

### Sessions Command
Run `/sessions` to open the session browser.

### Selecting a Session
- Use arrow keys to navigate through the list
- Press Enter to select a session
- The command will be inserted as `/resume <path>` in the editor

### Restoring a Session
After selecting a session:
1. Press Enter to execute the `/resume` command
2. Pi will restore the conversation state from the selected session file

## Requirements

- Session files must exist in `~/.pi/agent/sessions/` directory
- Files must be in JSONL format with proper session entries
- At least one user message in the session for preview generation

## Technical Details

- Scans all subdirectories recursively for `.jsonl` files
- Sorts sessions by file modification time (most recent first)
- Limits display to 20 most recent sessions
- Parses JSONL format to extract user messages for previews
- Truncates long previews to 100 characters
- Handles file reading errors gracefully