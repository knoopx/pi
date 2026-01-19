---
name: python
description: Always use when working with Python projects
---

This skill provides modern templates and best practices for Python development, focusing on code organization, testing, type safety, and code quality.

## Core Principles

- **Type Hints**: Enforce with `ruff` and `mypy`
- **Testing**: Use `pytest` for quality assurance
- **Code Quality**: Format with `ruff format`, lint with `ruff check`
- **Project Organization**: Clear structure and conventions
- **Documentation**: Write docstrings for all public APIs

## Project Structure

```
my-project/
├── pyproject.toml              # Project metadata and dependencies
├── README.md                   # Project documentation
├── src/
│   └── my_project/
│       ├── __init__.py
│       ├── main.py
│       ├── utils.py
│       └── py.typed            # PEP 561 type stub marker
├── tests/
│   ├── conftest.py             # pytest configuration
│   ├── test_main.py
│   └── test_utils.py
├── docs/                       # Documentation (optional)
└── .gitignore
```

## Project Configuration

### pyproject.toml

```toml
[project]
name = "my-project"
version = "0.1.0"
description = "My awesome project"
requires-python = ">=3.9"
authors = [
    { name = "Your Name", email = "you@example.com" }
]
readme = "README.md"
license = { text = "MIT" }
dependencies = [
    "requests>=2.31.0",
]

[project.optional-dependencies]
ml = ["scikit-learn>=1.0.0", "torch>=2.0.0"]
web = ["fastapi>=0.104.0", "uvicorn>=0.24.0"]

[dependency-groups]
dev = [
    "pytest>=7.0.0",
    "pytest-cov>=4.0.0",
    "ruff>=0.1.0",
    "mypy>=1.0.0",
]
docs = [
    "sphinx>=7.0.0",
    "sphinx-rtd-theme>=2.0.0",
]

[tool.ruff]
line-length = 100
target-version = "py39"

[tool.ruff.lint]
select = ["E", "F", "W", "I"]  # Errors, pyflakes, warnings, isort
ignore = ["E203", "E501"]      # Whitespace before ':', line too long

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
line-ending = "auto"

[tool.mypy]
python_version = "3.9"
strict = true
warn_return_any = true
warn_unused_ignores = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --strict-markers"
markers = [
    "slow: marks tests as slow (deselect with '-m \"not slow\"')",
    "integration: marks tests as integration tests",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

## Code Style and Quality

### Formatting with Ruff

```bash
# Format all Python files
uv run ruff format .

# Check formatting without changes
uv run ruff format --check .

# Format specific directory
uv run ruff format src/ tests/
```

### Linting with Ruff

```bash
# Check for issues
uv run ruff check .

# Auto-fix fixable issues
uv run ruff check . --fix

# Show rules for violations
uv run ruff check . --show-fixes

# Check specific rule
uv run ruff check . --select E501
```

### Type Checking with mypy

```bash
# Type check entire project
uv run mypy src/

# Type check specific file
uv run mypy src/main.py

# Show error codes
uv run mypy --show-error-codes src/

# Strict mode
uv run mypy --strict src/
```

## Testing

### pytest Basics

```bash
# Run all tests
uv run pytest

# Run tests in verbose mode
uv run pytest -v

# Run specific test file
uv run pytest tests/test_main.py

# Run specific test function
uv run pytest tests/test_main.py::test_greet

# Run tests matching pattern
uv run pytest -k "test_add or test_subtract"
```

### Code Coverage

```bash
# Run tests with coverage
uv run pytest --cov=src tests/

# Generate HTML coverage report
uv run pytest --cov=src --cov-report=html tests/

# Show missing lines
uv run pytest --cov=src --cov-report=term-missing tests/
```

### Test Organization

```bash
# Mark tests
uv run pytest -m "not slow"      # Skip slow tests
uv run pytest -m integration     # Run only integration tests

# Run in parallel (with pytest-xdist)
uv run pytest -n auto

# Stop on first failure
uv run pytest -x

# Show local variables on failure
uv run pytest -l
```

## Writing Good Tests

### Test Structure

```python
"""Tests for the utils module."""

import pytest
from my_project.utils import add, divide


class TestArithmetic:
    """Tests for arithmetic operations."""

    def test_add(self) -> None:
        """Test adding two numbers."""
        assert add(2, 3) == 5
        assert add(-1, 1) == 0
        assert add(0, 0) == 0

    def test_divide(self) -> None:
        """Test division operation."""
        assert divide(10, 2) == 5
        assert divide(7, 2) == 3.5

    def test_divide_by_zero(self) -> None:
        """Test division by zero raises error."""
        with pytest.raises(ValueError, match="Cannot divide by zero"):
            divide(10, 0)


class TestEdgeCases:
    """Tests for edge cases."""

    @pytest.mark.parametrize("a,b,expected", [
        (1, 1, 2),
        (10, 20, 30),
        (-5, 5, 0),
    ])
    def test_add_parametrized(self, a: int, b: int, expected: int) -> None:
        """Test add with multiple inputs."""
        assert add(a, b) == expected
```

### Fixtures for Test Setup

```python
"""Test fixtures."""

import pytest
from my_project.database import Database


@pytest.fixture
def db() -> Database:
    """Create a test database."""
    db = Database(":memory:")
    db.init()
    yield db
    db.close()


@pytest.fixture
def sample_data(db: Database) -> dict:
    """Populate database with sample data."""
    data = {"id": 1, "name": "Test User"}
    db.insert("users", data)
    return data


def test_user_insert(db: Database, sample_data: dict) -> None:
    """Test user insertion."""
    user = db.get("users", sample_data["id"])
    assert user["name"] == "Test User"
```

## Type Hints

### Function Type Hints

```python
"""Module with comprehensive type hints."""

from typing import Optional, Union, List, Dict, Tuple


def greet(name: str) -> str:
    """Greet a person by name."""
    return f"Hello, {name}!"


def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


def process_data(
    data: List[Dict[str, Union[int, str]]],
    filter_key: Optional[str] = None,
) -> Tuple[int, List[str]]:
    """Process data and return count and names."""
    names = [d.get("name", "") for d in data if filter_key is None or filter_key in d]
    return len(names), names


def find_user(user_id: int) -> Optional[Dict[str, str]]:
    """Find a user by ID, or return None."""
    # Implementation
    pass
```

### Class Type Hints

```python
"""Classes with type hints."""

from dataclasses import dataclass
from typing import Generic, TypeVar


@dataclass
class User:
    """Represent a user."""

    id: int
    name: str
    email: str

    def __repr__(self) -> str:
        return f"User({self.id}, {self.name})"


T = TypeVar('T')


class Container(Generic[T]):
    """Generic container class."""

    def __init__(self, value: T) -> None:
        self.value = value

    def get(self) -> T:
        return self.value

    def set(self, value: T) -> None:
        self.value = value
```

## Example Code

### Type-Safe Function with Docstring

```python
"""Module for greeting utilities."""


def greet(name: str, formal: bool = False) -> str:
    """
    Greet a person.

    Args:
        name: The person's name.
        formal: If True, use formal greeting.

    Returns:
        A greeting string.

    Examples:
        >>> greet("Alice")
        'Hello, Alice!'
        >>> greet("Bob", formal=True)
        'Good day, Bob!'
    """
    if formal:
        return f"Good day, {name}!"
    return f"Hello, {name}!"
```

### Exception Handling with Types

```python
"""Module for file operations."""

from pathlib import Path
from typing import Optional


def read_file(path: Path) -> Optional[str]:
    """
    Read file contents safely.

    Args:
        path: Path to file.

    Returns:
        File contents or None if file doesn't exist.

    Raises:
        PermissionError: If file cannot be read.
    """
    try:
        return path.read_text()
    except FileNotFoundError:
        return None
    except PermissionError as e:
        raise PermissionError(f"Cannot read {path}") from e
```

## Documentation

### Module Docstrings

```python
"""
my_project.utils
================

Utility functions for the my_project package.

This module provides helper functions for common operations
including data processing, formatting, and validation.

Example:
    Basic usage::

        from my_project.utils import greet
        print(greet("Alice"))
"""
```

### Class Docstrings

```python
"""
my_project.models.User
======================

User model and operations.
"""


class User:
    """
    Represent a user in the system.

    Attributes:
        id: Unique user identifier.
        name: User's full name.
        email: User's email address.
    """

    def __init__(self, id: int, name: str, email: str) -> None:
        """Initialize a user."""
        self.id = id
        self.name = name
        self.email = email
```

## Common Workflows

### Setup Development Environment

```bash
# 1. Create project (using uv or other tool)
uv init my-project --app
cd my-project

# 2. Add dependencies
uv add requests pydantic
uv add --dev pytest ruff mypy pytest-cov

# 3. Sync environment
uv sync

# 4. Verify setup
uv run python -c "import requests; print(requests.__version__)"
```

### Development Loop

```bash
# 1. Write code
# Edit src/my_project/main.py

# 2. Format
uv run ruff format .

# 3. Lint
uv run ruff check . --fix

# 4. Type check
uv run mypy src/

# 5. Test
uv run pytest -v

# 6. Check coverage
uv run pytest --cov=src tests/

# 7. Run development server: `tmux new -d 'uv run uvicorn my_project.main:app --reload'`
```

### Pre-commit Workflow

```bash
# Install pre-commit hook
pip install pre-commit
pre-commit install

# Create .pre-commit-config.yaml
cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.1.0
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.5.0
    hooks:
      - id: mypy
        args: [src]
EOF
```

## Best Practices

1. **Type Hints Always**: Use type hints for all function parameters and return values
2. **Write Docstrings**: Document all public modules, classes, and functions
3. **100% Test Coverage**: Aim for comprehensive test coverage of business logic
4. **Use pytest Fixtures**: Organize test setup with fixtures, not setup methods
5. **Parametrize Tests**: Use `@pytest.mark.parametrize` for multiple test cases
6. **Strict Type Checking**: Enable `mypy --strict` mode in `pyproject.toml`
7. **Format on Save**: Integrate `ruff format` with your editor
8. **Use Virtual Environments**: Always isolate project dependencies
9. **Meaningful Names**: Use clear, descriptive names for variables and functions
10. **Avoid print() in Libraries**: Use logging module instead

## Related Skills

- **uv**: Manage Python dependencies, control Python versions, and set up projects with uv.

## Related Tools

- **pip-search**: Search for Python packages on PyPI.
- **pip-show**: Show information about a specific Python package.
- **pip-list**: List installed Python packages.
- **generate-codemap**: Generate a compact map of the codebase structure, symbols, and dependencies.
- **analyze-dependencies**: Analyze dependency tree for files or show external packages used in the project.
