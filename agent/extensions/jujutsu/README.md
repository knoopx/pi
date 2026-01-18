# Jujutsu Extension

A production-grade Pi coding agent extension that provides change-based undo/redo functionality integrated with [Jujutsu (JJ)](https://github.com/martinvonz/jj) version control.

## Features

- **Automatic Changes**: Creates JJ changes before processing each user message
- **Undo Command**: Revert to the previous user message and restore repository state
- **Redo Command**: Restore after undo operations (supports multi-level redo)
- **Smart Description Generation**: Uses AI to generate conventional commit messages from diffs
- **Robust Error Handling**: Graceful degradation when commands fail
- **Session-Based**: Changes are maintained in memory for the current session

## Requirements

- [Jujutsu (JJ)](https://github.com/martinvonz/jj) must be installed and available in PATH
- A JJ repository must be initialized in the project directory
- Pi command must be available for description generation (optional)

## Installation

The extension is automatically loaded when placed in the `agent/extensions/jujutsu/` directory.

## Usage

### Automatic Operation

The extension works automatically:

- Before each user message is processed, a JJ change is created
- The change captures the repository state before any changes
- Changes are associated with user message entries for navigation
- After changes are made, AI generates conventional commit descriptions (if pi command available)

### Manual Commands

#### Undo

Revert to the previous user message and restore the repository state:

```
/undo
```

This command:

- Switches JJ to the change before the last user message was processed
- Navigates the conversation back to that user message
- Puts you in edit mode at that point

#### Redo

Restore the state after an undo operation:

```
/redo
```

Supports multiple redo levels by maintaining a stack of previous states. When redoing, both the repository state and conversation position are restored to continue editing from where you left off.

## Examples

### Basic Undo/Redo Workflow

1. User sends a message that causes code changes
2. Agent processes the message and makes changes
3. JJ change is created with AI-generated description
4. User realizes they want to revert: `/undo`
5. JJ switches back to pre-processing state
6. Conversation navigates to the previous user message
7. User can edit the message or continue differently
8. To restore: `/redo` (navigates forward and restores the state)

### Error Handling

The extension gracefully handles:

- JJ not being installed (extension deactivates)
- Repository not being a JJ repo (extension deactivates)
- Pi command not available (description generation skipped)
- JJ command failures (with user notifications)
- AI generation timeouts or failures (with fallback behavior)

## Configuration

Changes are stored in memory for the current session only. When the extension is restarted, all changes are lost and undo/redo functionality becomes unavailable until new changes are created.

## Technical Details

- Uses JJ's `jj new` to create changes with user message previews
- Associates changes with conversation entries via Pi's session management
- Maintains a redo stack for multi-level undo/redo
- Handles prompt truncation for JJ change descriptions
- Uses subprocess spawning for AI description generation with proper timeout and signal handling
- Implements comprehensive error handling and logging

## Production Features

- **Type Safety**: Full TypeScript with strict mode
- **Error Handling**: Comprehensive error catching and user-friendly notifications
- **Performance**: Efficient subprocess management with timeouts
- **Testing**: Full test coverage with Vitest
- **Code Quality**: ESLint compliant with proper JSDoc documentation
- **Signal Handling**: Proper AbortSignal support for cancellable operations