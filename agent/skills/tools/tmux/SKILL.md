---
name: tmux
description: "Manages background processes, captures command output, and handles session multiplexing. Use when running long-running commands, capturing output from detached processes, or managing concurrent tasks in headless environments."
token_cost: 210
keywords:
  [
    "tmux",
    "background",
    "process",
    "session",
    "detached",
    "concurrent",
    "output",
  ]
---

# tmux

Terminal multiplexer for background processes, output capture, and session management. Every process runs in a named session you can inspect later.

## Running Background Processes

Start a command in a named detached session:

```bash
tmux new-session -d -s myserver 'python -m http.server 8080'
tmux new-session -d -s build -c /path/to/project 'make build'
```

Keep a session alive after the command completes:

```bash
tmux new-session -d -s task 'command; exec bash'
```

Only create if it doesn't exist:

```bash
tmux has -t myserver || tmux new-session -d -s myserver 'command'
```

## Capturing Output

Get the output from a running session:

```bash
tmux capture-pane -t mysession -p           # Visible output only
tmux capture-pane -t mysession -p -S -      # Full scrollback history
tmux capture-pane -t mysession -p -S -100   # Last 100 lines
tmux capture-pane -t mysession -p > file.txt  # Save to file
```

## Sending Input

Send keystrokes to a session:

```bash
tmux send-keys -t mysession 'echo hello' Enter    # Type and press Enter
tmux send-keys -t mysession C-c                    # Send Ctrl+C
```

## Waiting for Completion

Signal when a job finishes, then wait for it:

```bash
tmux new-session -d -s job 'command; tmux wait-for -S job-done'
tmux wait-for job-done
```

## Session Management

```bash
tmux ls                                    # List all sessions
tmux kill-session -t myserver              # Kill specific session
tmux kill-server                           # Kill all sessions
```

## Common Patterns

**Development servers:**

```bash
tmux new-session -d -s backend 'bun run backend'
tmux new-session -d -s frontend 'bun run frontend'
```

**Run and capture output in a script:**

```bash
tmux new-session -d -s job 'command'
sleep 0.5
output=$(tmux capture-pane -t job -p)
echo "$output"
```

## Tips

- Use `-c /path` to set working directory when creating a session
- Use `exec bash` to keep sessions alive after commands finish
- Use `-S -` with `capture-pane` to get full scrollback history
