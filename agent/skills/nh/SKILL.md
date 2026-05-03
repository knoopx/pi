---
name: nh
description: Switches NixOS/Home Manager configurations, cleans old generations, and performs system maintenance. Use when running os/home switch, pruning the Nix store, or managing system generations.
---

# nh (Nix Helper)

Cleaner interface for Nix operations — builds, switches, and garbage collection with readable output.

## Switching Configuration

Build and activate a configuration:

```bash
nh os switch path:.           # NixOS — build and activate
nh os test path:.             # Build and test (rollback after timeout)
nh os build path:.            # Build only, don't activate
nh os boot path:.             # Make it the boot default without activating
```

Home Manager:

```bash
nh home switch path:.         # Build and activate Home Manager config
nh home build path:.          # Build only
```

macOS with nix-darwin:

```bash
nh darwin switch path:.       # Build and activate darwin config
```

Path inference works — `nh os switch` uses the local `flake.nix` in the current directory. Prefix remote paths with `path:` to include untracked files.

## Maintenance & Cleanup

Clean the Nix store and old generations:

```bash
nh clean all --keep-since 7d  # Remove profiles older than 7 days
nh clean user --keep 5        # Keep last 5 user profiles
nh clean all                  # Full garbage collection
```

## Searching & Updating

Search available packages:

```bash
nh search ripgrep             # Search by name or description
```

Update flake inputs before building:

```bash
nh os switch --update path:.  # Update inputs, then build and switch
```

## Common Options

- `--dry` — show what would happen without making changes
- `--ask` — ask for confirmation (avoid in headless/automated scripts)

## Related Skills

- **nix**: Run packages temporarily and evaluate Nix expressions
- **nix-flakes**: Initialize flakes, lock dependencies, build packages
