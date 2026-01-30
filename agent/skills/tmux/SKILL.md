---
name: tmux
description: Manages background processes, captures command output, and handles session multiplexing. Use when running long-running commands, capturing output from detached processes, or managing concurrent tasks in headless environments.
---

# tmux

Terminal multiplexer for background processes, output capture, and session management.

## Quick Reference

| Command                               | Description                       |
| ------------------------------------- | --------------------------------- |
| `tmux new -d -s name 'cmd'`           | Run command in background session |
| `tmux capture-pane -t name -p`        | Capture output from session       |
| `tmux send-keys -t name 'text' Enter` | Send input to session             |
| `tmux kill-session -t name`           | Terminate session                 |
| `tmux ls`                             | List all sessions                 |
| `tmux has -t name`                    | Check if session exists           |

## Running Background Processes

### Start a Detached Session

```bash
# Run a command in a new detached session
tmux new-session -d -s myserver 'python -m http.server 8080'

# With a specific working directory
tmux new-session -d -s build -c /path/to/project 'make build'

# Run shell command and keep session alive after completion
tmux new-session -d -s task 'command; exec bash'
```

### Run and Wait for Completion

```bash
# Run command and wait for it to finish
tmux new-session -d -s job 'long-running-command'
tmux wait-for job-done  # Blocks until signaled

# In the command, signal completion:
tmux new-session -d -s job 'long-running-command; tmux wait-for -S job-done'
```

## Capturing Output

### Capture Pane Contents

```bash
# Capture visible output (prints to stdout)
tmux capture-pane -t mysession -p

# Capture entire scrollback history
tmux capture-pane -t mysession -p -S -

# Capture last N lines
tmux capture-pane -t mysession -p -S -100

# Capture specific line range (0 = first visible, negative = scrollback)
tmux capture-pane -t mysession -p -S -50 -E -1

# Save to file
tmux capture-pane -t mysession -p > output.txt

# Capture with escape sequences (preserves colors)
tmux capture-pane -t mysession -p -e
```

## Sending Input

### Send Keys to Session

```bash
# Send text to the active pane
tmux send-keys -t mysession 'echo hello' Enter

# Send multiple keystrokes
tmux send-keys -t mysession 'cd /path/to/project' Enter

# Send without Enter key
tmux send-keys -t mysession 'some-text' C-m  # Ctrl+M (Enter)
```

## Session Management

### List All Sessions

```bash
# List all tmux sessions
tmux list-sessions

# List with format
tmux list-sessions -F "#{session_name}: #{session_windows} windows"
```

### Kill Sessions

```bash
# Kill a specific session
tmux kill-session -t myserver

# Kill all sessions
tmux kill-server
```

### Check if Session Exists

```bash
# Check if session exists
tmux has -t mysession

# If not exists, start it
tmux has -t myserver || tmux new-session -d -s myserver 'command'
```

## Related Skills

- **vitest**: Running tests with watch mode
- **bun**: Development servers and watch mode
