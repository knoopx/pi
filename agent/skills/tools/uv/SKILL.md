---
name: uv
description: "Initializes Python projects, manages dependencies, pins Python versions, and runs scripts with uv. Use when adding/removing packages, syncing environments, running tools with uvx, or building distributions."
token_cost: 220
keywords:
  ["uv", "python", "dependency", "package", "version", "script", "uvx", "env"]
---

# uv

Fast Python package and project manager — 10-100x faster than pip with built-in virtual environment management.

## Project Setup

```bash
uv init my-app             # App project
uv init my-lib --lib      # Library project
uv init --script script.py # Standalone script
uv python pin 3.11        # Pin Python version for the project
```

## Managing Dependencies

```bash
uv add requests           # Add a dependency
uv add --dev pytest       # Add dev dependency
uv add --optional ml scikit-learn  # Add optional group
uv remove requests        # Remove a dependency
uv lock                   # Update lockfile only
uv export > requirements.txt  # Export to pip format
```

Commit `uv.lock` for reproducibility.

## Syncing Environments

```bash
uv sync                   # Install all dependencies
uv sync --no-dev          # Skip dev dependencies
uv sync --all-extras      # Include all optional groups
uv sync --refresh         # Recreate venv from scratch
uv sync --locked          # Fail if lockfile would change (CI-friendly)
```

## Running Code

```bash
uv run python script.py   # Run a script with project deps available
uv run -m pytest          # Run a module
uv run --with requests script.py  # Add a one-off dependency
uv run --extra ml train.py  # Use optional dependencies
uv run --env-file .env script.py  # Load environment variables
```

`uv run` handles virtual environment creation automatically.

## Installing Tools

```bash
uvx ruff check .          # Run a tool once without installing
uv tool install ruff      # Install globally for reuse
uv tool list              # List installed tools
uv tool upgrade ruff      # Upgrade a tool
```

Tools are isolated from project dependencies.

## Building & Publishing

```bash
uv build                 # Build source and wheel distributions
uv publish               # Publish to PyPI
```

## Formatting

```bash
uv format                # Format Python code
uv format --check        # Check without changes
```

## Project Versioning

```bash
uv version 1.2.3         # Set version
uv version --bump major  # Bump major version
```

## Typical CI Workflow

```bash
uv sync --locked           # Install deps from lockfile
uv run pytest              # Run tests
uv run ruff check .        # Lint
```
