#!/usr/bin/env bash

set -e

id="$(date +%Y%m%d-%H%M%S)"
workspacePath=".jj/pi/${id}"
mkdir -p "${workspacePath}"
jj workspace add "${workspacePath}"
jj -R "${workspacePath}" desc -m "New session ${id}"
cd "${workspacePath}" && pi "$@" && jj log
rm -rf "${workspacePath}"
jj workspace forget "${id}"