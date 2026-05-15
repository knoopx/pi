---
name: shell-session
description: "Run commands in a persistent bash session with stateful cd, env vars, and job state. Use when running multi-step workflows, building projects, or any task requiring state between commands."
token_cost: 140
related: [bash, tmux]
keywords:
  [
    "shell",
    "session",
    "bash",
    "persistent",
    "stateful",
    "interactive",
    "workflow",
    "multi-step",
    "sequence",
  ]
---

## shell-session Tool

Stateful bash: cd, env vars, and job state persist across calls.

REQUIRED: command (one shell command, NOT a script)
OPTIONAL: timeout (seconds; default 30, use 120–300 for installs/builds)

RULES:

- ONE command per turn. Read the output before proposing the next.
- State persists: set vars / cd once, reuse later.
- Never run interactive commands (`vi`, `less`, `top`, `python` bare REPL).
  Use non-interactive equivalents (`cat`, `sed -i`, `python -c '…'`).
- Output ends with `[exit=N cwd=… timed_out=…]` — check exit=0 before claiming success.
- If timed_out=true, do NOT just retry; diagnose (longer timeout, narrower command).

EXAMPLE:

```tool
{"name": "shell-session", "input": {"command": "cd /work && ls -la"}}
```

EXAMPLE with timeout:

```tool
{"name": "shell-session", "input": {"command": "pip install -q requests", "timeout": 180}}
```

## Workflow

1. **One command at a time**: Run a single command, read output, then proceed
2. **Leverage state**: Set env vars or cd once, reuse in subsequent commands
3. **Check exit code**: Verify `exit=0` in the footer before assuming success
4. **Handle timeouts**: If `timed_out=true`, diagnose the cause rather than retrying blindly
5. **Avoid interactivity**: Never run editors, pagers, or REPLs; use non-interactive equivalents
