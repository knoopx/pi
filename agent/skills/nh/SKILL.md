---
name: nh
description: Manage NixOS and Home Manager operations with improved output and cleanup.
---

# nh (Nix Helper) Skill

`nh` is a CLI tool that simplifies Nix operations, providing a cleaner interface for builds, switches, and garbage collection.

## Core Commands

### System Updates (NixOS)

Use `nh os` for managing NixOS configurations. Prefix local paths with `path:`.

```bash
# Build and switch to a configuration (equivalent to nixos-rebuild switch)
nh os switch path:.

# Build and test a configuration (equivalent to nixos-rebuild test)
nh os test path:.

# Build a configuration without switching (equivalent to nixos-rebuild build)
nh os build path:.
```

### Home Manager Updates

Use `nh home` for managing Home Manager configurations.

```bash
# Build and switch Home Manager configuration
nh home switch path:.

# Build Home Manager configuration without switching
nh home build path:.
```

### Maintenance and Cleanup

`nh clean` provides a more intuitive way to manage the Nix store and generations.

```bash
# Clean generations older than 7 days
nh clean all --keep-since 7d

# Keep only the last 5 generations
nh clean all --keep 5

# Run garbage collection on the Nix store
nh clean all
```

## Common Options

- `--ask`: Ask for confirmation before performing actions (Avoid in headless/automated scripts).
- `--dry`: Show what would happen without making changes.
- `--update`: Update flake inputs before building.

## Best Practices

- **Headless Usage**: Avoid using the `--ask` flag in scripts or automated environments as it requires user interaction.
- **Path Inference**: `nh` automatically looks for a `flake.nix` in the current directory if no path is provided.
- **Visuals**: `nh` provides a more readable "Nom-like" output by default, which is helpful for monitoring build progress in a terminal.

## Related Skills

- **nix**: Use Nix for running applications without installation and evaluating Nix expressions.
- **nix-flakes**: Leverage Nix Flakes for reproducible builds and project isolation with nh.
