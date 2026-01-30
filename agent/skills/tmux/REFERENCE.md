# tmux Reference

Detailed patterns, examples, and workflows for tmux.

## Common Patterns

### Running Development Servers

```bash
# Run a web server in background
tmux new-session -d -s webserver 'bun run dev'

# Run a database in background
tmux new-session -d -s database 'docker run -d postgres:alpine'

# Run multiple services
tmux new-session -d -s backend 'bun run backend'
tmux new-session -d -s frontend 'bun run frontend'
tmux new-session -d -s tests 'vitest --watch'
```

### Running Tests with tmux

```bash
# Run tests in background
tmux new-session -d -s tests 'vitest'

# Run tests with watch mode
tmux new-session -d -s tests 'vitest --watch'

# Run tests with coverage
tmux new-session -d -s coverage 'vitest --coverage'

# Run tests and wait for completion
tmux new-session -d -s tests 'vitest && tmux wait-for -S tests-done'
```

### Running Build Processes

```bash
# Run build process
tmux new-session -d -s build 'bun run build'

# Run with specific directory
tmux new-session -d -s build -c /path/to/project 'make build'

# Run with environment variables
tmux new-session -d -s build 'NODE_ENV=production bun run build'
```

### Running Shell Commands

```bash
# Run shell command and keep session alive
tmux new-session -d -s shell 'exec bash'

# Run command and then exit
tmux new-session -d -s job 'command; exit'
```

## Advanced Patterns

### Capture Command Output

```bash
# Run command and capture output
tmux new-session -d -s job 'command'
sleep 0.5
output=$(tmux capture-pane -t job -p)
echo "$output"

# Run command and capture output in one line
output=$(tmux new-session -d -s job 'command' && sleep 0.5 && tmux capture-pane -t job -p)
echo "$output"
```

### Interactive Commands

```bash
# Run interactive command and send input
tmux new-session -d -s interact 'npm install'
sleep 0.5
tmux send-keys -t interact 'y' Enter
```

### Conditional Session Creation

```bash
# Create session only if it doesn't exist
tmux has -t myserver || tmux new-session -d -s myserver 'command'
```

### Multiple Sessions

```bash
# Create multiple sessions
tmux new-session -d -s backend 'bun run backend'
tmux new-session -d -s frontend 'bun run frontend'
tmux new-session -d -s tests 'vitest --watch'

# List all sessions
tmux list-sessions

# Kill specific session
tmux kill-session -t backend

# Kill all sessions
tmux kill-server
```

### Session Templates

```bash
# Template for running backend server
tmux new-session -d -s backend 'bun run backend'

# Template for running database
tmux new-session -d -s database 'docker run -d postgres:alpine'

# Template for running tests
tmux new-session -d -s tests 'vitest --watch'

# Template for running build
tmux new-session -d -s build 'bun run build'
```

## Workflow Examples

### Development Workflow

```bash
# 1. Start backend server
tmux new-session -d -s backend 'bun run backend'

# 2. Start frontend server
tmux new-session -d -s frontend 'bun run frontend'

# 3. Start tests with watch mode
tmux new-session -d -s tests 'vitest --watch'

# 4. Run tests
sleep 0.5
output=$(tmux capture-pane -t tests -p)
echo "$output"

# 5. Stop all sessions
tmux kill-server
```

### CI/CD Workflow

```bash
# Start build process
tmux new-session -d -s build 'bun run build'

# Wait for build to complete
sleep 0.5
output=$(tmux capture-pane -t build -p)
echo "$build_output"

# Run tests
tmux new-session -d -s tests 'vitest'
sleep 0.5
output=$(tmux capture-pane -t tests -p)
echo "$test_output"

# Stop all sessions
tmux kill-server
```

### Background Task Workflow

```bash
# Start long-running task
tmux new-session -d -s task 'long-running-command'

# Wait for task to complete
sleep 0.5
output=$(tmux capture-pane -t task -p)
echo "$output"

# Stop task
tmux kill-session -t task
```

## Tips

- Use `tmux new-session -d` for background processes
- Use `tmux capture-pane -p -S -` for full scrollback
- Use `tmux has -t name` to check session existence
- Use `tmux kill-server` to clean up all sessions
- Use `tmux list-sessions` to see all active sessions
- Use `tmux send-keys -t name 'text' Enter` to send input
- Use `tmux new-session -d -s name 'command'` for quick commands
- Use `tmux new-session -d -s name -c /path command` for custom directories
- Use `tmux new-session -d -s name 'command; exec bash'` to keep session alive
- Use `tmux new-session -d -s name 'command; tmux wait-for -S name-done'` for completion tracking
