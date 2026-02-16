#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="/tmp/pi-demo-repo-$$"
PI_DIR="$HOME/.pi"

cleanup() {
	rm -rf "$DEMO_DIR"
	rm -f "$SCRIPT_DIR"/*.tape
}
trap cleanup EXIT

rm -rf "$DEMO_DIR"
mkdir -p "$DEMO_DIR"

echo "==> Creating demo repository in $DEMO_DIR"

cd "$DEMO_DIR"
git init -q
jj git init --colocate 2>/dev/null

mkdir -p src tests

cat >src/utils.ts <<'EOF'
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-");
}
EOF

cat >src/api.ts <<'EOF'
import { formatDate } from "./utils";

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export async function fetchUsers(): Promise<User[]> {
  const response = await fetch("/api/users");
  return response.json();
}

export async function createUser(name: string, email: string): Promise<User> {
  const response = await fetch("/api/users", {
    method: "POST",
    body: JSON.stringify({ name, email, createdAt: formatDate(new Date()) }),
  });
  return response.json();
}
EOF

cat >src/index.ts <<'EOF'
import { fetchUsers, createUser } from "./api";
import { capitalize } from "./utils";

async function main() {
  const users = await fetchUsers();
  for (const user of users) {
    console.log(capitalize(user.name));
  }
}

main();
EOF

cat >tests/utils.test.ts <<'EOF'
import { describe, it, expect } from "vitest";
import { formatDate, capitalize, slugify } from "../src/utils";

describe("formatDate", () => {
  it("formats date as ISO string", () => {
    const date = new Date("2024-01-15T12:00:00Z");
    expect(formatDate(date)).toBe("2024-01-15");
  });
});

describe("capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });
});

describe("slugify", () => {
  it("converts to lowercase slug", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });
});
EOF

cat >package.json <<'EOF'
{
  "name": "demo-project",
  "type": "module",
  "scripts": { "test": "vitest run" }
}
EOF

cat >README.md <<'EOF'
# Demo Project

A sample TypeScript project for screenshot demos.
EOF

jj describe -m "Initial project setup" 2>/dev/null
jj bookmark create main 2>/dev/null
jj new -m "Add validation helpers" 2>/dev/null

cat >>src/utils.ts <<'EOF'

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
EOF

jj new -m "Add user validation to API" 2>/dev/null

cat >>src/api.ts <<'EOF'

export function validateUser(user: Partial<User>): string[] {
  const errors: string[] = [];
  if (!user.name) errors.push("Name is required");
  if (!user.email) errors.push("Email is required");
  return errors;
}
EOF

jj new -m "Add logging utility" 2>/dev/null

cat >src/logger.ts <<'EOF'
type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

export function debug(message: string): void {
  log("debug", message);
}

export function info(message: string): void {
  log("info", message);
}
EOF

jj bookmark create feature/logging 2>/dev/null

echo "==> Generating screenshots"
cd "$SCRIPT_DIR"

gen_tape() {
	local name="$1"
	local keys="$2"
	cat >"$name.tape" <<EOF
Output $name.png
Set Shell "bash"
Set FontSize 14
Set Width 1400
Set Height 800
Set Theme "Catppuccin Mocha"

Hide
Type "cd $DEMO_DIR && pi -ne -e $PI_DIR/agent/extensions/ide --no-session"
Enter
Sleep 1s
Show

$keys

Escape
Sleep 200ms
Type "q"
Enter
EOF
}

gen_tape "files" 'Ctrl+p
Sleep 300ms
Type "api"
Sleep 200ms
Screenshot files.png'

gen_tape "symbols" 'Ctrl+t
Sleep 300ms
Type "user"
Sleep 200ms
Screenshot symbols.png'

gen_tape "bookmarks" 'Type "/bookmarks"
Enter
Sleep 300ms
Screenshot bookmarks.png'

gen_tape "changes" 'Type "/changes"
Enter
Sleep 300ms
Down
Sleep 200ms
Screenshot changes.png'

gen_tape "oplog" 'Type "/oplog"
Enter
Sleep 300ms
Screenshot oplog.png'

gen_tape "workspaces" 'Ctrl+j
Sleep 300ms
Screenshot workspaces.png'

gen_tape "skills" 'Type "/skills"
Enter
Sleep 300ms
Screenshot skills.png'

gen_tape "commands" 'Type "/commands"
Enter
Sleep 300ms
Type "change"
Sleep 200ms
Screenshot commands.png'

gen_tape "symbol-callers" 'Ctrl+t
Sleep 300ms
Type "formatDate"
Sleep 200ms
Ctrl+c
Sleep 300ms
Screenshot symbol-callers.png
Escape'

gen_tape "describe" 'Type "/changes"
Enter
Sleep 300ms
Space
Down
Space
Sleep 200ms
Type "d"
Sleep 1s
Screenshot describe.png'

for tape in files symbols bookmarks changes oplog workspaces skills commands symbol-callers describe; do
	echo "--- $tape ---"
	nix run nixpkgs#vhs -- "$tape.tape" 2>&1 | tail -1
done

echo "==> Done!"
ls -la *.png
