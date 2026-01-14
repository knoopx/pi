---
name: nix
description: Run applications without installation, create development environments, and evaluate Nix expressions.
---

# Nix Skill

Nix is a powerful package manager and functional programming language. This skill covers common operations like running apps on-the-fly and managing environments.

## Running Applications

You can run any application from `nixpkgs` without installing it permanently.

```bash
# Run a package once
nix run nixpkgs#hello

# Run a package with specific arguments
nix run nixpkgs#cowsay -- "Hello from Nix!"

# Run a command within a shell environment (non-interactive)
nix shell nixpkgs#git nixpkgs#vim --command git --version
```

## Evaluating Expressions (Debugging)

Since the environment is headless and non-interactive, use `nix eval` instead of the REPL for debugging.

```bash
# Evaluate a simple expression
nix eval --expr '1 + 2'

# Inspect an attribute from nixpkgs
nix eval nixpkgs#hello.name

# Evaluate a local nix file
nix eval --file ./default.nix

# List keys in a set (useful for exploration)
nix eval --expr 'builtins.attrNames (import <nixpkgs> {})'
```

## Searching for Packages

```bash
# Search for a package by name or description
nix search nixpkgs python3
```

## Common Nix Language Patterns

### Variables and Functions

```nix
# Let binding
let
  name = "Nix";
in
  "Hello ${name}"

# Function definition
let
  multiply = x: y: x * y;
in
  multiply 2 3
```

### Attribute Sets

```nix
{
  a = 1;
  b = "foo";
}
```

## Troubleshooting

- **Broken Builds**: Use `nix log` to see the build output of a derivation.
- **Dependency Issues**: Use `nix-store -q --references $(which program)` to see what a program depends on.
- **Cache issues**: Add `--no-substitute` to force a local build if you suspect a bad binary cache.

## Related Skills

- **nix-flakes**: Use Nix Flakes for reproducible builds and dependency management in Nix projects.
- **nh**: Manage NixOS and Home Manager operations with improved output using nh.
