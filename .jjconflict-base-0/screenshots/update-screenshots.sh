#!/usr/bin/env bash
# Generates screenshots by running VHS tape files.
# Requires: vhs, pi, jj
# Usage: ./update-screenshots.sh [tape-name...]
#   No args = run all tapes. Args = run only named tapes (without .tape extension).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAPE_DIR="$SCRIPT_DIR/tapes"
DEMO_DIR="/tmp/pi-demo"

# Setup demo repo if needed
if [[ ! -d "$DEMO_DIR/.jj" ]]; then
	echo "==> Setting up demo repo"
	bash "$SCRIPT_DIR/setup-demo-repo.sh"
fi

cd "$SCRIPT_DIR"

if [[ $# -gt 0 ]]; then
	tapes=("$@")
else
	tapes=()
	for f in "$TAPE_DIR"/*.tape; do
		tapes+=("$(basename "$f" .tape)")
	done
fi

for tape in "${tapes[@]}"; do
	echo "--- $tape ---"
	nix run nixpkgs#vhs -- "$TAPE_DIR/$tape.tape"
done

echo "==> Done"
ls -1 *.png
