# Nix Extension

Tools for searching NixOS packages, options, Home Manager configurations, and Nixpkgs pull requests.

## Installation

No additional installation required. This extension uses public APIs from NixOS and GitHub.

## Tools

### search-nix-packages

**Label:** Search Nix Packages

**Description:** Find packages available in the NixOS package repository.

Use this to:
- Discover software packages for installation
- Check package versions and descriptions
- Find packages by name or functionality
- Get package metadata and maintainers

Returns detailed package information from nixpkgs.

**Parameters:**
- `query` (string): Search query (package name, description, or programs)

### search-nix-options

**Label:** Search Nix Options

**Description:** Find configuration options available in NixOS.

Use this to:
- Discover system configuration settings
- Find options for services and modules
- Check option types and default values
- Get examples for configuration

Returns NixOS configuration option details.

**Parameters:**
- `query` (string): Search query (option name or description)

### search-home-manager-options

**Label:** Search Home-Manager Options

**Description:** Find configuration options for Home Manager.

Use this to:
- Configure user-specific settings
- Set up dotfiles and user programs
- Customize desktop environment
- Manage user-level services

Returns Home Manager configuration options.

**Parameters:**
- `query` (string): Search query (option name or description)

### search-nixpkgs-pull-requests

**Label:** Search Nixpkgs Pull Requests

**Description:** Search for pull requests in the NixOS/nixpkgs repository.

Use this to:
- Track package updates and changes
- Find ongoing development work
- Monitor contributions to nixpkgs
- Discover recent package additions

Returns GitHub pull request information.

**Parameters:**
- `query` (string): Search query (title, number, or keywords)