---
name: jc
description: Convert the output of common CLI tools into JSON for easier processing and analysis. Use when parsing command-line tool output, processing data with JSON tools like jq, or analyzing system information programmatically.
---

# JC Skill

This skill provides commands for using `jc` to convert traditional command-line output into JSON.

## Basic Usage

```bash
# Pipe output of a command to jc
ls -l | jc --ls | jq '.[0].filename'

# Use the -p flag for pretty-print
uptime | jc --uptime -p
```

## Supported Commands

`jc` supports over 100 commands. Here are some common ones:

- `ls`: `ls -l | jc --ls`
- `ps`: `ps aux | jc --ps`
- `df`: `df -h | jc --df`
- `ifconfig`: `ifconfig | jc --ifconfig`
- `netstat`: `netstat -rn | jc --netstat`
- `dig`: `dig google.com | jc --dig`
- `ping`: `ping -c 3 google.com | jc --ping`
- `uptime`: `uptime | jc --uptime`
- `crontab`: `crontab -l | jc --crontab`

## Magic Mode

The `--magic` (or `-m`) flag attempts to automatically detect the command:

```bash
jc -m ls -l
jc -m ping -c 3 google.com
```

## Useful Patterns

### Combining with JQ

```bash
# Get the IP address of the first interface
ifconfig | jc --ifconfig | jq '.[0].ipv4_addr'

# List files larger than 1MB
ls -lh | jc --ls | jq '.[] | select(.size > 1000000) | .filename'
```

### Formatting Output

```bash
# YAML output
ls -l | jc --ls --yaml
```

## Cheat Sheet

### Common Parsers

- `--ls`
- `--ps`
- `--df`
- `--dig`
- `--ping`
- `--ifconfig`
- `--env`
- `--ini`
- `--xml`
- `--csv`

### Global Options

- `-p`, `--pretty`: Pretty-print JSON.
- `-m`, `--magic`: Auto-detect command.
- `-q`, `--quiet`: Suppress warning messages.
- `-r`, `--raw`: Do not process values (no type conversion).
- `--yaml`: Output YAML instead of JSON.

## Related Skills

- **nu-shell**: Process jc's JSON output using nu-shell's structured data handling and pipelines.
