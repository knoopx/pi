# Guardrails Plugin

A comprehensive pi extension that enforces best practices by blocking potentially harmful or non-reproducible commands and file edits.

![Demo](screenshot.png)

#### Interactive Commands

Prevents execution of commands that launch interactive editors, pagers, REPLs, or shells:

- **Editors**: `vim`, `vi`, `nano`, `emacs`, `pico`, `ed`
- **Pagers**: `less`, `more`, `most`, `pg`, `man`
- **REPLs**: `python` (bare), `node` (bare), `irb`, `ghci`, `ipython`
- **Interactive Shells**: `bash -i`, `zsh -i`, `bash` (bare), `zsh` (bare)

**Exception**: Python/Node commands with scripts or flags are allowed:
- ✅ `python script.py`
- ✅ `python -c "print('hello')"`
- ✅ `node -e "console.log('hello')"`
- ❌ `python` (interactive REPL)
- ❌ `node` (interactive REPL)

#### JavaScript/Node.js Commands

- **`node`** - Blocked in favor of `bun` or `bunx`
- **`npm`** - Blocked in favor of `bun` or `bunx`

#### Python Commands

- **`pip`** - Blocked in favor of `uv` or `uvx`
- **`python`**, **`python2`**, **`python3`** - Blocked in favor of `uv` or `uvx`
  - **Exception**: Virtual environment python commands are allowed:
    - ✅ `.venv/bin/python`, `.venv/bin/python3`
    - ✅ `venv/bin/python`, `venv/bin/python3`
    - ✅ `env/bin/python`, `env/bin/python3`

#### Git Commands

- **Write operations** - Only read-only git commands are allowed:
  - ✅ `git status`
  - ✅ `git diff`
  - ✅ `git show`
  - ❌ `git add`, `git commit`, `git push`, `git checkout`, etc.

#### Nix Commands

- **Local flake references** - Must use proper prefixes:
  - ✅ `nix run path:./my-flake#output`
  - ✅ `nix run github:user/repo#output`
  - ✅ `nix run git+https://github.com/user/repo#output`
  - ❌ `nix run ./my-flake#output`

#### Privilege Escalation Commands

- **`sudo`** and **`su`** - Blocked to prevent privilege escalation:
  - ❌ `sudo apt update`
  - ❌ `su root`
  - **Rationale**: Agents should instruct system administrators to perform privileged operations

### File Edit Blocking

#### Lock Files

Prevents editing of auto-generated lock files:

- `package-lock.json` - Use `bun install` or `bun update` instead
- `bun.lockb` - Use `bun install` or `bun update` instead
- `yarn.lock` - Use `yarn install` or `yarn upgrade` instead
- `pnpm-lock.yaml` - Use `pnpm install` or `pnpm update` instead
- `poetry.lock` - Use `poetry install` or `poetry update` instead
- `uv.lock` - Use `uv sync` or `uv lock` instead
- `Cargo.lock` - Use `cargo update` instead
- `Gemfile.lock` - Use `bundle install` or `bundle update` instead
- `flake.lock` - Use `nix flake update` instead

## Installation

```bash
# Add to your pi plugins
```

## Configuration

The plugin works out of the box with sensible defaults. All blocking rules are hardcoded for consistency and reliability.

## Usage Examples

### Allowed Commands

```bash
# JavaScript with Bun
bun install
bunx create-react-app my-app

# Python with uv
uv sync
uvx ruff check .

# Virtual environment python (allowed)
.venv/bin/python script.py
venv/bin/python3 -c "print('hello')"

# Git read operations
git status
git diff HEAD~1
git show HEAD

# Nix with proper prefixes
nix run path:./my-flake#hello
nix run github:nix-community/nixpkgs-fmt#nixpkgs-fmt
```

### Blocked Commands

```bash
# These will be blocked with helpful error messages
node --version
npm install
pip install requests
python script.py  # (but python -c "code" is allowed)
python  # (interactive REPL blocked)
node  # (interactive REPL blocked)
git add .
vim file.txt
nano file.txt
less file.txt
man ls
bash -i
zsh
irb
ghci
sudo apt update
su root
```

## Advanced Features

### Escape Method Detection

The plugin detects and blocks various command injection techniques:

- **Piping**: `echo "node --version" | bash`
- **Command substitution**: `echo $(node --version)`
- **Backticks**: `echo \`node --version\``
- **Semicolons**: `ls; node --version`
- **Logical operators**: `ls && node --version`
- **Background execution**: `node --version &`
- **Redirection**: `node --version > output.txt`
- **Environment variables**: `NODE_ENV=prod node app.js`
- **Eval/Exec**: `eval "node --version"`
- **Quoted strings**: `bash -c "node --version"`

### Complex Pattern Matching

The plugin uses sophisticated regex patterns to detect blocked commands in:

- Complex command structures
- Multi-line commands
- Nested command substitutions
- Various quoting styles

## Testing

Run the test suite:

```bash
npm test
# or
bun test
```

The plugin includes comprehensive tests covering:

- All blocked commands and allowed alternatives
- File edit restrictions
- Various escape methods and edge cases
- Integration scenarios

## Rationale

This plugin enforces several development best practices:

1. **Reproducibility**: Blocks direct package manager usage in favor of modern alternatives
2. **Lock File Integrity**: Prevents manual editing of auto-generated lock files
3. **Git Workflow**: Encourages proper git workflows by limiting write operations
4. **Nix Best Practices**: Ensures proper flake referencing for reproducibility
5. **Security**: Blocks potentially harmful command injection techniques and privilege escalation attempts

## Contributing

When adding new blocking rules:

1. Add the rule to the appropriate constant (e.g., `BLOCKED_COMMAND_MESSAGES`)
2. Implement the validation logic in the corresponding function
3. Add comprehensive tests covering various usage patterns
4. Update this README with the new functionality

## License

This plugin is part of the pi ecosystem.
