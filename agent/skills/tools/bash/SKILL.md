---
name: bash
description: "Execute a single shell command in the project working directory. Returns stdout+stderr combined. Stateless — use shell-session for multi-step workflows."
token_cost: 120
related: [shell-session, nu]
keywords:
  [
    "run",
    "execute",
    "install",
    "build",
    "test",
    "shell",
    "command",
    "cmd",
    "bash",
    "script",
    "npm",
    "bun",
    "make",
  ]
---

## Bash Tool

Execute a single shell command and return stdout+stderr combined.

REQUIRED: command (shell command string)
OPTIONAL: timeout (seconds, NO default — always set for installs/builds)

RULES:

- Stateless: each call starts a fresh shell. `cd` and env vars do NOT persist.
- ALWAYS chain directory changes: `cd /path && command`
- Set `timeout` for any command that might take >30s (installs, builds, downloads)
- NEVER run interactive commands (`vim`, `less`, `top`, bare `python`/`node` REPL)
- Prefer dedicated tools (grep, find, ls, read) over bash for file operations
- Output truncated to last 200 lines / 5KB; full output saved to temp file if truncated

EXAMPLE:

```tool
{"name": "bash", "input": {"command": "ls -la /home/user/project"}}
```

EXAMPLE with timeout:

```tool
{"name": "bash", "input": {"command": "cd /home/user/project && npm install", "timeout": 120}}
```

## When to use

- **Use bash**: One-off commands, package installs, builds, quick checks
- **Use shell-session**: Multi-step workflows, repeated commands, stateful sessions
- **Use grep/find/ls**: File searching, directory listing, pattern matching (faster, respects .gitignore)

## Workflow

1. **Simple command**: Pass the command string directly
2. **Directory operations**: Chain with `&&` (e.g., `cd /path && make`)
3. **Long-running tasks**: ALWAYS set `timeout` to 120-300 for installs, builds, or downloads
4. **Check output**: Verify the command succeeded before proceeding
