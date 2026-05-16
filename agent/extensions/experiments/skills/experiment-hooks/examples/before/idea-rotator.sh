#!/usr/bin/env bash
# If experiment.ideas.md exists, surface the top unchecked bullet
# as a steer nudge. Format assumes markdown checkboxes: `- [ ] idea`.

set -euo pipefail

readonly IDEAS_FILE="experiment.ideas.md"
readonly UNCHECKED_PATTERN='^- \[ \]'

first_unchecked_idea() {
  grep -m1 -E "$UNCHECKED_PATTERN" "$1" | sed 's/^- \[ \] //'
}

input="$(cat)"
ideas="$(jq -r '.cwd' <<<"$input")/$IDEAS_FILE"
[ -f "$ideas" ] || exit 0

next=$(first_unchecked_idea "$ideas")
[ -z "$next" ] && exit 0
echo "Next idea from $IDEAS_FILE: $next"
