#!/usr/bin/env bash
# Creates a demo jj repository for screenshot generation.
# Usage: DEMO_DIR=/tmp/pi-demo ./setup-demo-repo.sh
set -euo pipefail

DEMO_DIR="${DEMO_DIR:-/tmp/pi-demo}"

rm -rf "$DEMO_DIR"
mkdir -p "$DEMO_DIR"
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

echo "$DEMO_DIR"
