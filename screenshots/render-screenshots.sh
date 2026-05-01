#!/usr/bin/env nix-shell
#! nix-shell -i bash -p bun charm-freeze nerd-fonts.jetbrains-mono librsvg
set -euo pipefail

export FREEZE_BIN="$(which freeze)"
export FONT_FAMILY="JetBrainsMono Nerd Font"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bun run "$SCRIPT_DIR/render-screenshots.ts"
