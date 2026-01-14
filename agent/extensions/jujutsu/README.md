# Jujutsu Extension

A Pi coding agent extension that provides snapshot-based undo/redo functionality integrated with [Jujutsu (JJ)](https://github.com/martinvonz/jj) version control.

## Features

- **Automatic Snapshots**: Creates JJ snapshots before processing each user message
- **Undo Command**: Revert to the previous user message and restore repository state
- **Redo Command**: Restore after undo operations (supports multi-level redo)
- **Snapshots Command**: List available checkpoints
- **Session-Based**: Snapshots are maintained in memory for the current session

## Requirements

- [Jujutsu (JJ)](https://github.com/martinvonz/jj) must be installed and available in PATH
- A JJ repository must be initialized in the project directory

## Installation

The extension is automatically loaded when placed in the `agent/extensions/jujutsu/` directory.

## Usage

### Automatic Operation

The extension works automatically:
- Before each user message is processed, a JJ snapshot is created
- The snapshot captures the repository state before any changes
- Snapshots are associated with user message entries for navigation

### Manual Commands

#### Undo
Revert to the previous user message and restore the repository state:

```
/undo
```

This command:
- Switches JJ to the checkpoint before the last user message was processed
- Navigates the conversation back to that user message
- Puts you in edit mode at that point

#### Redo
Restore the state after an undo operation:

```
/redo
```

Supports multiple redo levels by maintaining a stack of previous states. When redoing, both the repository state and conversation position are restored to continue editing from where you left off.

#### Snapshots
List all available snapshots:

```
/snapshots
```

Shows:
- Available checkpoints with their JJ change IDs
- Current active checkpoint
- Number of redo levels available

## Examples

### Basic Undo/Redo Workflow

1. User sends a message that causes code changes
2. Agent processes the message and makes changes
3. User realizes they want to revert: `/undo`
4. JJ switches back to pre-processing state
5. Conversation navigates to the previous user message
6. User can edit the message or continue differently
7. To restore: `/redo` (navigates forward and restores the state)

### Checking Available Snapshots

```
/snapshots
```

Output:
```
Available snapshots:
abc12345... (current) - Entry: msg-456
def67890... - Entry: msg-123
Redo available: 1 level(s)
```

### Error Handling

The extension gracefully handles:
- JJ not being installed (commands fail silently during auto-snapshot)
- Repository not being a JJ repo
- JJ command failures (with user notifications)

## Configuration

Snapshots are stored in memory for the current session only. When the extension is restarted, all snapshots are lost and undo/redo functionality becomes unavailable until new snapshots are created.

## Technical Details

- Uses JJ's `jj new` to create change commits with user message previews
- Associates snapshots with conversation entries via Pi's session management
- Maintains a redo stack for multi-level undo/redo
- Handles prompt truncation for JJ commit messages (80 char limit)
- **Snapshots are stored in memory only and are lost when the session restarts**</content>
<parameter name="path">agent/extensions/jujutsu/README.md