#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const IDE_SNAPS = join(
  SCRIPT_DIR,
  "..",
  "agent",
  "extensions",
  "ide",
  "components",
);
const USAGE_SNAPS = join(SCRIPT_DIR, "..", "agent", "extensions", "usage");
const EXT_SNAPS = join(SCRIPT_DIR, "..", "agent", "extensions");
const FREEZE_CMD = [process.env.FREEZE_BIN || "freeze"];
const FONT_FAMILY = process.env.FONT_FAMILY || "JetBrainsMono Nerd Font";
const FREEZE_ARGS: string[] = [
  "--language",
  "plain",
  "--background",
  "#101033",
];
FREEZE_ARGS.push("--font.family", FONT_FAMILY);
FREEZE_ARGS.push(
  "--font.size",
  "14",
  "--padding",
  "10,20,10,20",
  "--border.radius",
  "8",
);

const FEATURES: Record<string, { snap: string; test: string }> = {
  bookmarks: {
    snap: join(IDE_SNAPS, "bookmarks", "__snapshots__", "index.test.ts.snap"),
    test: "renders all bookmarks with consistent padding",
  },
  changes: {
    snap: join(IDE_SNAPS, "changes", "__snapshots__", "renderer.test.ts.snap"),
    test: "then renders left focus indicator when focused on changes",
  },
  files: {
    snap: join(IDE_SNAPS, "files", "__snapshots__", "index.test.ts.snap"),
    test: "renders file rows with mixed extensions and consistent left alignment",
  },
  symbols: {
    snap: join(IDE_SNAPS, "symbols", "__snapshots__", "index.test.ts.snap"),
    test: "after cycle - all filter",
  },
  workspaces: {
    snap: join(
      IDE_SNAPS,
      "workspaces",
      "__snapshots__",
      "navigation.test.ts.snap",
    ),
    test: "then renders default workspace with changes list",
  },
  "move-mode": {
    snap: join(IDE_SNAPS, "changes", "__snapshots__", "move-mode.test.ts.snap"),
    test: "then renders full split-panel with move indicator",
  },
  todos: {
    snap: join(IDE_SNAPS, "todos", "__snapshots__", "index.test.ts.snap"),
    test: "renders all TODOs with consistent padding",
  },
  oplog: {
    snap: join(IDE_SNAPS, "oplog", "__snapshots__", "index.test.ts.snap"),
    test: "renders all operations with consistent padding",
  },
  "pull-requests": {
    snap: join(
      IDE_SNAPS,
      "pull-requests",
      "__snapshots__",
      "index.test.ts.snap",
    ),
    test: "renders all PRs with consistent padding",
  },
  "symbol-references": {
    snap: join(
      IDE_SNAPS,
      "symbol-references",
      "__snapshots__",
      "index.test.ts.snap",
    ),
    test: "renders caller symbols with file paths and line numbers",
  },
  duckduckgo: {
    snap: join(EXT_SNAPS, "duckduckgo", "__snapshots__", "index.test.ts.snap"),
    test: "should format search results correctly",
  },
  nix: {
    snap: join(EXT_SNAPS, "nix", "__snapshots__", "nix.test.ts.snap"),
    test: "then it should return formatted package results",
  },
  npm: {
    snap: join(EXT_SNAPS, "npm", "__snapshots__", "npm.test.ts.snap"),
    test: "then it should return formatted search results",
  },
  pypi: {
    snap: join(EXT_SNAPS, "pypi", "__snapshots__", "pypi.test.ts.snap"),
    test: "then it should return formatted package info",
  },
  guardrails: {
    snap: join(
      EXT_SNAPS,
      "guardrails",
      "__snapshots__",
      "snapshot.test.ts.snap",
    ),
    test: "renders audit output with active groups and rules",
  },
  "reverse-history-search": {
    snap: join(
      EXT_SNAPS,
      "reverse-history-search",
      "__snapshots__",
      "snapshot.test.ts.snap",
    ),
    test: "renders history search results with query filter",
  },
  usage: {
    snap: join(USAGE_SNAPS, "usage", "__snapshots__", "snapshot.test.ts.snap"),
    test: "renders usage dashboard with provider data and totals",
  },
  "tool-usage": {
    snap: join(
      USAGE_SNAPS,
      "tool-usage",
      "__snapshots__",
      "snapshot.test.ts.snap",
    ),
    test: "renders tool usage dashboard with per-tool stats",
  },
  editor: {
    snap: join(IDE_SNAPS, "editor", "__snapshots__", "component.test.ts.snap"),
    test: "then shows line numbers and content with left border",
  },
  "bookmark-prompt": {
    snap: join(
      IDE_SNAPS,
      "bookmark-prompt",
      "__snapshots__",
      "index.test.ts.snap",
    ),
    test: "renders multiple bookmarks with consistent padding",
  },
  hooks: {
    snap: join(EXT_SNAPS, "hooks", "__snapshots__", "snapshot.test.ts.snap"),
    test: "renders audit output with active groups and hooks",
  },
  "turn-stats": {
    snap: join(
      EXT_SNAPS,
      "turn-stats",
      "__snapshots__",
      "snapshot.test.ts.snap",
    ),
    test: "renders end-of-run aggregate with all fields",
  },
  gh: {
    snap: join(EXT_SNAPS, "gh", "__snapshots__", "index.test.ts.snap"),
    test: "then it should return formatted repo list",
  },
};

function parseSnapFile(path: string): Record<string, string> {
  const content = readFileSync(path, "utf8");
  // Snap files are valid JS modules: exports[`name 1`] = `"string"`;
  // Values are template literals wrapping a quoted string, so we strip the outer quotes and whitespace.
  const raw: Record<string, unknown> = {};
  new Function("exports", content)(raw);
  const exports: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      exports[key] = value.trim().replace(/^"|"$/g, "");
    }
  }
  return exports;
}

function renderToPNG(text: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(FREEZE_CMD[0], [
      ...FREEZE_CMD.slice(1),
      ...FREEZE_ARGS,
      "-o",
      output,
    ]);
    child.stdin.write(text);
    child.stdin.end();
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`exit ${code}`)),
    );
    child.on("error", reject);
  });
}

function findSnapshotExport(
  exports: Record<string, string>,
  testName: string,
): string | null {
  return Object.keys(exports).find((name) => name.includes(testName))
    ? undefined
    : null;
}

async function renderFeature(
  feature: string,
  snapPath: string,
  testName: string,
): Promise<void> {
  process.stdout.write(`${feature}: `);

  const exports = parseSnapFile(snapPath);
  const matchedKey = Object.keys(exports).find((name) =>
    name.includes(testName),
  );

  if (!matchedKey) {
    console.log(`SKIP (no export matching "${testName}")`);
    return;
  }

  const output = join(SCRIPT_DIR, `${feature}.png`);
  await renderToPNG(exports[matchedKey], output);
  const size = statSync(output).size;
  console.log(`OK ${(size / 1024).toFixed(1)} KB`);
}

async function main() {
  for (const [feature, { snap, test }] of Object.entries(FEATURES)) {
    try {
      await renderFeature(feature, snap, test);
    } catch (err) {
      console.error(`FAIL: ${err}`);
    }
  }
}

main();
