---
name: nix
description: Runs packages temporarily, creates isolated shell environments, and evaluates Nix expressions. Use when executing tools without installing, debugging derivations, or working with nixpkgs.
---

# Nix

Package manager and functional language for reproducible environments. Run any tool once without installing it permanently.

## Running Packages

Execute a package from `nixpkgs` directly:

```bash
nix run nixpkgs#cowsay -- "Hello!"    # Run with arguments
nix run nixpkgs#hello                  # Simple command
```

For long-running services, wrap in tmux: `tmux new -d 'nix run nixpkgs#some-server'`.

## Shell Environments

Create a temporary shell with specific tools:

```bash
nix shell nixpkgs#git nixpkgs#vim --command git --version
```

## Evaluating Expressions

Debug and inspect Nix expressions in headless environments:

```bash
nix eval --expr '1 + 2'              # Simple expression
nix eval nixpkgs#hello.name          # Inspect an attribute
nix eval --file ./default.nix        # Evaluate a local file
nix eval --expr 'builtins.attrNames (import <nixpkgs> {})'  # List keys
```

## Searching Packages

```bash
nix search nixpkgs python3           # Search by name or description
```

## Formatting Nix Files

```bash
nix fmt                              # Format current directory
nix fmt -- --check                   # Check formatting without changes
```

## Hash Utilities

Convert between hash formats:

```bash
# Convert SRI to nix32 format
nix hash convert --hash-algo sha256 --to nix32 sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=

# Convert nix32 to SRI
nix hash convert --hash-algo sha256 --from nix32 --to sri 1b8m03r63zqhnjf7l5wnldhh7c134ap5vpj0850ymkq1iyzicy5s
```

Prefetch a URL and get its hash:

```bash
nix-prefetch-url --unpack https://example.com/source.tar.gz
```

## Shebang Scripts

Use Nix as a script interpreter:

```bash
#!/usr/bin/env nix
#! nix shell nixpkgs#bash nixpkgs#curl --command bash
curl -s https://example.com
```

## Troubleshooting

- **Broken builds**: `nix log <derivation>` to see build output
- **Dependency chains**: `nix why-depends nixpkgs#hello nixpkgs#glibc`
- **Bad cache**: Add `--no-substitute` to force local build
- **References**: `nix-store -q --references $(which program)`

## Related Skills

- **nix-flakes**: Reproducible builds with flake.nix
- **nh**: Cleaner interface for NixOS/Home Manager operations
