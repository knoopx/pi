---
name: uv
description: Manage Python dependencies, control Python versions, and set up projects with uv.
---

# UV Skill

`uv` is an extremely fast Python package manager and project orchestrator written in Rust. It replaces `pip`, `venv`, and `pyproject.toml`-based tools with a single, unified interface.

## Core Concepts

- **Project-Aware**: Manages dependencies, virtual environments, and Python versions
- **Fast**: 10-100x faster than traditional tools
- **Minimal Configuration**: Works with standard `pyproject.toml`
- **Deterministic**: `uv.lock` file ensures reproducible builds
- **Python Management**: Download and manage multiple Python versions

## Project Initialization

### Create a New Project

```bash
# Application project (with `__main__.py`)
uv init my-app --app

# Library project (with package structure)
uv init my-lib --lib

# Standalone Python script
uv init my-script.py --script

# Bare project (only `pyproject.toml`)
uv init my-bare --bare
```

### Options

```bash
# With specific Python version
uv init --python 3.11 my-project

# With build backend choice
uv init --build-backend hatch my-project

# Without git initialization
uv init --vcs none my-project

# Without README
uv init --no-readme my-project

# As a package (installable)
uv init --package my-project
```

## Dependency Management

### Adding Dependencies

```bash
# Add production dependencies
uv add requests numpy pandas

# Add development dependencies
uv add --dev pytest ruff mypy

# Add optional dependencies (extras)
uv add --optional ml scikit-learn torch
uv add --optional web fastapi uvicorn

# Add from specific version
uv add 'requests>=2.28.0,<3.0'
uv add 'ruff==0.1.0'

# Add from Git repository
uv add git+https://github.com/user/repo.git
uv add --rev main git+https://github.com/user/repo.git
uv add --tag v1.0.0 git+https://github.com/user/repo.git
uv add --branch feature git+https://github.com/user/repo.git

# Add from local path
uv add --editable ./path/to/local/package

# Add with extras
uv add 'requests[socks]'

# Add to specific dependency group
uv add --group type-checking mypy
```

### Removing Dependencies

```bash
# Remove package
uv remove requests

# Remove from optional dependencies
uv remove --optional ml scikit-learn
```

### Viewing Dependencies

```bash
# Display dependency tree
uv tree

# Include all groups
uv tree --all-groups

# Only dev dependencies
uv tree --only-group dev

# With depth limit
uv tree --depth 2
```

## Virtual Environment

uv manages virtual environments automatically, but you can control it:

```bash
# Sync project dependencies to virtual environment
uv sync

# Sync only production dependencies
uv sync --no-dev

# Sync only development dependencies
uv sync --only-dev

# Sync specific groups
uv sync --group type-checking --group docs

# Exclude groups
uv sync --no-group docs

# Include all optional dependencies
uv sync --all-extras

# Sync to active virtual environment
uv sync --active

# Recreate venv (exact sync)
uv sync --refresh

# Don't install the project itself
uv sync --no-install-project
```

## Running Code

### With uv run

```bash
# Run Python script
uv run python script.py

# Run Python module
uv run -m pytest
uv run -m http.server

# Run with specific extras
uv run --extra ml python train.py

# Run without dev dependencies
uv run --no-dev python main.py

# Run with temporary packages
uv run --with requests python fetch.py
uv run --with 'numpy>=1.20' python analyze.py

# Run with multiple temp packages
uv run --with requests --with pandas python data.py

# Run in isolated environment
uv run --isolated --with pytest pytest

# Load environment variables from .env
uv run --env-file .env python script.py
```

### Running Scripts with Dependencies

```bash
# Python script can declare dependencies inline:

# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "requests>=2.31.0",
#     "pandas>=2.0.0",
# ]
# ///

import requests
import pandas as pd

response = requests.get("https://api.example.com/data")
df = pd.DataFrame(response.json())
print(df)
```

Then run with:

```bash
uv run script.py
```

## Python Version Management

### List Python Installations

```bash
# List all available Python versions
uv python list

# Show only installed versions
uv python list --only-installed

# Find Python in system
uv python find 3.11
uv python find pypy
```

### Install Python Versions

```bash
# Install specific version
uv python install 3.12

# Install multiple versions
uv python install 3.10 3.11 3.12

# Install PyPy
uv python install pypy3.10

# Install latest patch version
uv python install 3.12
```

### Pin Python Version

```bash
# Pin to specific version (creates `.python-version`)
uv python pin 3.11

# Unpin (remove `.python-version`)
uv python pin --clear
```

### Directory and Upgrade

```bash
# Show Python installation directory
uv python dir

# Upgrade installed Python versions
uv python upgrade 3.11
uv python upgrade --all

# Uninstall Python version
uv python uninstall 3.10
uv python uninstall pypy
```

## Tool Management

Use `uv tool` for global CLI tools without polluting project dependencies:

```bash
# Run tool once (temporary install)
uv tool run ruff -- --version
uv tool run black -- script.py

# Install tool globally
uv tool install ruff
uv tool install black
uv tool install poetry

# List installed tools
uv tool list

# Upgrade tool
uv tool upgrade ruff
uv tool upgrade --all

# Uninstall tool
uv tool uninstall ruff

# Update shell PATH for tools
uv tool update-shell
```

## Locking and Reproducibility

### Lock File Management

```bash
# Update lock file (without syncing)
uv lock

# Regenerate lock file
uv lock --refresh

# Require lock file to be up-to-date
uv sync --locked

# Prevent lock file changes
uv add --locked package-name
```

### Exporting Lock File

```bash
# Export to requirements.txt format
uv export --output-file requirements.txt

# Export only production dependencies
uv export --no-dev --output-file requirements.txt

# Export with hashes for extra security
uv export --hashes --output-file requirements.txt

# Export specific format
uv export --format requirements-txt
uv export --format pip-tools
```

## Project Configuration

### pyproject.toml

```toml
[project]
name = "my-project"
version = "0.1.0"
description = "My project description"
requires-python = ">=3.9"
dependencies = [
    "requests>=2.31.0",
    "click>=8.0.0",
]

[project.optional-dependencies]
ml = ["scikit-learn>=1.0.0", "torch>=2.0.0"]
web = ["fastapi>=0.104.0", "uvicorn>=0.24.0"]

[dependency-groups]
dev = [
    "pytest>=7.0.0",
    "ruff>=0.1.0",
]
docs = [
    "sphinx>=7.0.0",
    "sphinx-rtd-theme>=2.0.0",
]

[tool.uv]
# Managed Python version
# python = "3.11"

# Dev dependencies by default when syncing
# dev = true
```

### uv.toml (Optional)

Create `uv.toml` for additional configuration:

```toml
[tool.uv]
# Python version
python = "3.11"

# Default groups to sync
default-groups = ["dev"]

[tool.uv.sources]
# Custom package sources (private registries, git repos)
my-package = { git = "https://github.com/user/my-package.git" }

[tool.uv.pip]
# pip-compatible options
compile = true
no-build-isolation = false

[tool.uv.build]
# Build system options
include = ["py.typed", "VERSION"]
```

## Building and Publishing

### Build Distributions

```bash
# Build wheel and source distribution
uv build

# Build only wheel
uv build --wheel

# Build only source distribution
uv build --sdist

# Build specific format
uv build --target wheel
```

### Publish to PyPI

```bash
# Publish distributions
uv publish

# Publish with token
uv publish --token pypi-AgEIcHlwaS5vcmc...

# Publish to test PyPI
uv publish --publish-url https://test.pypi.org/legacy/
```

## Common Workflows

### Initial Project Setup

```bash
# 1. Create project
uv init my-project --app
cd my-project

# 2. Pin Python version
uv python pin 3.11

# 3. Add dependencies
uv add requests pydantic
uv add --dev pytest ruff mypy

# 4. Sync environment
uv sync

# 5. Verify setup
uv tree
uv run python --version
```

### Adding a Feature with Dependencies

```bash
# Add feature dependencies
uv add --optional web fastapi uvicorn

# Update pyproject.toml manually to organize optional deps

# Sync
uv sync --all-extras

# Run with the feature
uv run --extra web python app.py
```

### Development Workflow

```bash
# Activate shell with project environment (if using direnv or similar)
# Otherwise just use uv run for everything

# Format code
uv run ruff format .

# Lint code
uv run ruff check . --fix

# Type check
uv run mypy src/

# Run tests
uv run pytest -v

# Run tests with coverage
uv run pytest --cov=src tests/
```

### Working with Monorepos/Workspaces

```bash
# Structure
# workspace/
# ├── pyproject.toml  (workspace root)
# ├── packages/
# │   ├── pkg-a/
# │   │   └── pyproject.toml
# │   └── pkg-b/
# │       └── pyproject.toml

# Sync all workspace packages
uv sync

# Add dependency to specific package
uv add --package pkg-a requests

# Run tests for all
uv run pytest tests/
```

## Environment Variables and .env Files

```bash
# Create `.env` file
cat > .env << EOF
DATABASE_URL=postgresql://localhost/mydb
API_KEY=secret123
EOF

# Load in uv run
uv run --env-file .env python script.py

# Load with --no-env-file to disable
uv run --no-env-file python script.py
```

## Troubleshooting

### Clear Cache

```bash
# Clear uv cache
uv cache clean

# Show cache directory
uv cache dir

# Run without cache
uv sync --no-cache
```

### Offline Mode

```bash
# Run without network access
uv sync --offline
uv run --offline python script.py
```

### Verbose Output

```bash
# Verbose output
uv sync -v
uv add -v requests

# Very verbose
uv sync -vv
```

## Best Practices

1. **Commit `uv.lock`**: Always commit to version control for reproducible builds
2. **Specify `requires-python`**: Define minimum Python version in `pyproject.toml`
3. **Use Dependency Groups**: Separate dev, test, and documentation dependencies
4. **Pin Project Python**: Use `uv python pin` to ensure team consistency
5. **Use `uv run`**: Execute scripts without manually activating virtual environments
6. **Tool Isolation**: Use `uv tool` for CLI utilities to avoid polluting project dependencies
7. **Use Extras for Features**: Organize optional dependencies with `[project.optional-dependencies]`
8. **Regular Updates**: Run `uv lock --refresh` to update dependencies while respecting constraints
9. **Export for CI/CD**: Use `uv export` to generate `requirements.txt` for legacy systems
10. **Source Control**: Commit `.python-version` and `uv.lock` files

## Related Skills

- **python**: Follow best practices for Python development when using uv for dependency management.

## Related Tools

- **pip-search**: Search for Python packages on PyPI.
- **pip-show**: Show information about a specific Python package.
- **pip-list**: List installed Python packages.
- **generate-codemap**: Generate a compact map of the codebase structure, symbols, and dependencies.
- **analyze-dependencies**: Analyze dependency tree for files or show external packages used in the project.
