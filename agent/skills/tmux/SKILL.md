---
name: tmux
description: Spawn background processes, run interactive tools detached, and capture command output using tmux sessions. Use when running long-running commands, capturing output from background processes, or managing multiple concurrent tasks.
---

# tmux Skill

Terminal multiplexer for background processes, output capture, and session management. Essential for headless/automated environments.

## Contents

- [Quick Reference](#quick-reference)
- [Running Background Processes](#running-background-processes)
- [Capturing Output](#capturing-output)
- [Sending Input](#sending-input)
- [Session Management](#session-management)
- [Windows and Panes](#windows-and-panes)
- [Common Patterns](#common-patterns)

## Quick Reference

| Command | Description |
|---------|-------------|
| `tmux new -d -s name 'cmd'` | Run command in background session |
| `tmux capture-pane -t name -p` | Capture output from session |
| `tmux send-keys -t name 'text' Enter` | Send input to session |
| `tmux kill-session -t name` | Terminate session |
| `tmux ls` | List all sessions |
| `tmux has -t name` | Check if session exists |

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

### Pipe Output in Real-Time

```bash
# Pipe pane output to a file (real-time logging)
tmux pipe-pane -t mysession -o 'cat >> /tmp/session.log'

# Stop piping
tmux pipe-pane -t mysession

# Pipe to a processing command
tmux pipe-pane -t mysession -o 'grep --line-buffered ERROR >> errors.log'
```

## Sending Input

### Send Keys to Session

```bash
# Send text followed by Enter
tmux send-keys -t mysession 'ls -la' Enter

# Send special keys
tmux send-keys -t mysession C-c        # Ctrl+C
tmux send-keys -t mysession C-d        # Ctrl+D (EOF)
tmux send-keys -t mysession Escape     # Escape key
tmux send-keys -t mysession C-z        # Ctrl+Z (suspend)

# Send literal text (no key interpretation)
tmux send-keys -t mysession -l 'literal text with C-c in it'

# Send to specific window:pane
tmux send-keys -t mysession:0.0 'command' Enter
```

### Interactive Automation

```bash
# Start interactive tool and send commands
tmux new-session -d -s repl 'python3'
sleep 1  # Wait for startup
tmux send-keys -t repl 'print("Hello")' Enter
sleep 0.5
tmux capture-pane -t repl -p
```

## Session Management

### Listing and Checking

```bash
# List all sessions
tmux list-sessions
tmux ls

# Check if session exists (exit code 0 if exists)
tmux has-session -t mysession && echo "exists"

# List windows in session
tmux list-windows -t mysession

# List panes in window
tmux list-panes -t mysession:0
```

### Killing Sessions

```bash
# Kill specific session
tmux kill-session -t mysession

# Kill all sessions except current
tmux kill-session -a

# Kill server (all sessions)
tmux kill-server

# Kill specific window
tmux kill-window -t mysession:0

# Kill specific pane
tmux kill-pane -t mysession:0.1
```

## Windows and Panes

### Multiple Windows

```bash
# Create session with named window
tmux new-session -d -s dev -n editor 'vim'

# Add another window
tmux new-window -t dev -n server 'npm start'

# Switch between windows (when attached)
tmux select-window -t dev:0
tmux select-window -t dev:server
```

### Split Panes

```bash
# Split horizontally
tmux split-window -t mysession -h 'command'

# Split vertically
tmux split-window -t mysession -v 'command'

# Target specific pane
tmux send-keys -t mysession:0.0 'top pane' Enter
tmux send-keys -t mysession:0.1 'bottom pane' Enter
```

## Common Patterns

### Run Command and Capture Output

```bash
#!/bin/bash
SESSION="task-$$"

# Start command
tmux new-session -d -s "$SESSION" 'your-command --args'

# Wait for completion (poll-based)
while tmux has-session -t "$SESSION" 2>/dev/null; do
    sleep 1
done

# Or with explicit signaling:
tmux new-session -d -s "$SESSION" 'your-command; tmux wait-for -S done-'"$SESSION"
tmux wait-for "done-$SESSION"

# Capture final output
OUTPUT=$(tmux capture-pane -t "$SESSION" -p -S -)
echo "$OUTPUT"

# Cleanup
tmux kill-session -t "$SESSION" 2>/dev/null
```

### Monitor Background Process

```bash
SESSION="monitor"

# Start process with logging
tmux new-session -d -s "$SESSION" 'long-process 2>&1'
tmux pipe-pane -t "$SESSION" -o 'cat >> /tmp/process.log'

# Check status periodically
while tmux has-session -t "$SESSION" 2>/dev/null; do
    echo "Still running... Last output:"
    tmux capture-pane -t "$SESSION" -p | tail -5
    sleep 10
done

echo "Process completed"
cat /tmp/process.log
```

### Run Interactive REPL

```bash
SESSION="python-repl"

# Start Python REPL
tmux new-session -d -s "$SESSION" 'python3 -u'  # -u for unbuffered
sleep 1

# Send commands
tmux send-keys -t "$SESSION" 'x = 42' Enter
tmux send-keys -t "$SESSION" 'print(f"Answer: {x}")' Enter
sleep 0.5

# Capture output
tmux capture-pane -t "$SESSION" -p

# Cleanup
tmux send-keys -t "$SESSION" 'exit()' Enter
```

### Run Server with Health Check

```bash
SESSION="server"

# Start server
tmux new-session -d -s "$SESSION" 'python -m http.server 8080'

# Wait for server to be ready
for i in {1..30}; do
    if curl -s http://localhost:8080 > /dev/null; then
        echo "Server ready"
        break
    fi
    sleep 1
done

# ... use server ...

# Cleanup
tmux kill-session -t "$SESSION"
```

### Parallel Task Execution

```bash
# Run multiple tasks in separate windows
tmux new-session -d -s parallel -n task1 'task1.sh; tmux wait-for -S t1'
tmux new-window -t parallel -n task2 'task2.sh; tmux wait-for -S t2'
tmux new-window -t parallel -n task3 'task3.sh; tmux wait-for -S t3'

# Wait for all tasks
tmux wait-for t1 &
tmux wait-for t2 &
tmux wait-for t3 &
wait

# Collect results
for win in task1 task2 task3; do
    echo "=== $win ==="
    tmux capture-pane -t "parallel:$win" -p
done

tmux kill-session -t parallel
```

## Environment and Options

### Set Environment Variables

```bash
# Set environment for session
tmux new-session -d -s mysession -e 'VAR=value' -e 'PATH=/custom:$PATH' 'command'

# Set environment in existing session
tmux set-environment -t mysession MY_VAR "value"
```

### Useful Options

```bash
# Increase scrollback buffer (default: 2000)
tmux set-option -t mysession history-limit 50000

# Enable mouse support (for debugging)
tmux set-option -t mysession mouse on

# Set default shell
tmux set-option -g default-shell /bin/bash
```

## Tips

- **Unique session names**: Use `$$` (PID) or `$(date +%s)` for unique names
- **Unbuffered output**: Use `-u` flag for Python, `stdbuf -oL` for others
- **Wait for startup**: Add `sleep` after starting interactive processes
- **Clean up**: Always kill sessions when done to avoid orphans
- **Check existence**: Use `tmux has -t name` before operations
- **Escape sequences**: Use `-e` flag with `capture-pane` to preserve colors
- **Line buffering**: Use `--line-buffered` with grep when piping

## Troubleshooting

- **No output captured**: Process may buffer output; use unbuffered mode
- **Session not found**: Check `tmux ls` for exact session name
- **Command exits immediately**: Add `; exec bash` to keep session alive
- **Special characters**: Use `-l` flag with `send-keys` for literal text
- **Timing issues**: Add `sleep` between send-keys and capture-pane
