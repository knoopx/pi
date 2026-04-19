import { vi } from "vitest";
import type {
  ExtensionAPI,
  ExtensionContext,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import {
  createMockPi,
  createMockTui,
  createMockTheme,
} from "../../lib/test-utils";

// ─── Mock file contents ────────────────────────────────────────────────────

const TS_CONTENT = `import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function register(pi: ExtensionAPI) {
  pi.registerCommand("test", {
    description: "Test command",
    async handler(_args, ctx) {
      console.log("Hello");
    },
  });
}
`;

const TSX_CONTENT = `import React from "react";

export function App() {
  return <div>Hello World</div>;
}
`;

const NIX_CONTENT = `{ pkgs ? import <nixpkgs> {} }:
{
  hello = pkgs.hello;
}
`;

const YAML_CONTENT = `version: "3"
services:
  app:
    image: myapp:latest
    ports:
      - "8080:80"
`;

const JSON_CONTENT = `{ "name": "my-package", "version": "1.0.0" }`;

const MD_CONTENT = `# My Project\n\nA sample project for testing.\n\n## Usage\n\nRun the tests with vitest.`;

const RS_CONTENT = `fn main() {
    println!("Hello, world!");
}
`;

const GO_CONTENT = `package main

import "fmt"

func main() {
    fmt.Println("Hello")
}
`;

const GITIGNORE_CONTENT = `node_modules/
*.log
.DS_Store
`;

const TOML_CONTENT = `[package]
name = "my-crate"
version = "0.1.0"
`;

const ENV_CONTENT = `DATABASE_URL=postgres://localhost/db\nAPI_KEY=test123`;

const DOCKERFILE_CONTENT = `FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["node", "index.js"]`;

const MAKEFILE_CONTENT = `all: build test\n\nbuild:\n\tgcc -o main main.c\n\ntest:\n\t./run-tests.sh`;

const LOCK_CONTENT = `{"nodes": {}}`;
const MOD_CONTENT = `module myapp\ngo 1.22`;
const TXT_CONTENT = `requests==2.31.0\nflask==3.0.0`;
const SNAP_CONTENT = `// Vitest Snapshot v1`;

// ─── Mock fs readFile implementation ───────────────────────────────────────

const FILENAME_CONTENTS: Record<string, string> = {
  ".gitignore": GITIGNORE_CONTENT,
  ".env": ENV_CONTENT,
  Dockerfile: DOCKERFILE_CONTENT,
  Makefile: MAKEFILE_CONTENT,
};

const EXTENSION_CONTENTS: Record<string, string> = {
  ts: TS_CONTENT,
  mts: TS_CONTENT,
  cts: TS_CONTENT,
  tsx: TSX_CONTENT,
  nix: NIX_CONTENT,
  yaml: YAML_CONTENT,
  yml: YAML_CONTENT,
  json: JSON_CONTENT,
  md: MD_CONTENT,
  rs: RS_CONTENT,
  go: GO_CONTENT,
  toml: TOML_CONTENT,
  lock: LOCK_CONTENT,
  mod: MOD_CONTENT,
  txt: TXT_CONTENT,
  snap: SNAP_CONTENT,
};

export async function mockReadFileImplementation(
  path: string | URL,
  _opts: unknown,
): Promise<string> {
  const actual = await import("node:fs/promises");
  const p = typeof path === "string" ? path : path.toString();
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const base = p.split("/").pop() ?? "";

  const byName = FILENAME_CONTENTS[base];
  if (byName) return byName;

  const byExt = EXTENSION_CONTENTS[ext];
  if (byExt) return byExt;

  return actual.readFile(
    path,
    _opts as Parameters<typeof actual.readFile>[1],
  ) as unknown as string;
}

// ─── Test fixtures ─────────────────────────────────────────────────────────

const REPO = "/home/user/project";

const DEFAULT_FILES_OUTPUT =
  "agent/extensions/ide/components/files.ts\nagent/extensions/ide/components/list-picker.ts\nagent/extensions/nix/nix.test.ts\n";

export function makeFilesMockPi(
  stdout = DEFAULT_FILES_OUTPUT,
  overrides?: Partial<ExtensionAPI>,
): ExtensionAPI {
  return createMockPi({
    exec: vi.fn().mockResolvedValue({ code: 0, stdout, stderr: "" }),
    ...overrides,
  });
}

export async function createFilesFixture(
  mockPi: ExtensionAPI,
  searchQuery = "",
) {
  const tui = createMockTui();
  const theme = createMockTheme();
  const ctx = { cwd: REPO } as ExtensionContext;

  const { createFilesComponent } = await import("./component");

  const component = createFilesComponent({
    pi: mockPi,
    tui,
    theme,
    keybindings: {} as unknown as KeybindingsManager,
    done: () => {},
    initialQuery: searchQuery,
    ctx,
  });

  await new Promise((r) => setTimeout(r, 50));
  return { component, tui };
}
