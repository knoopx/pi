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
const TS_FILES: Record<string, string> = {
  "agent/extensions/ide/components/files.ts": `
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { createListPicker } from "../../lib/list-picker";
import { createFilePreviewLoader } from "../../lib/preview-utils";
import { getFileIcon } from "../../lib/file-icons";

export function createFilesComponent(options) {
  const { pi, tui, theme, done, ctx } = options;
  return createListPicker({
    pi, tui, theme, done, initialQuery: "",
    config: {
      title: () => "Files",
      loadItems: (q) => rg(pi, ctx.cwd, q),
      formatItem: (f, w, t) => getFileIcon(f.path),
      loadPreview: createFilePreviewLoader(ctx.cwd, theme),
    },
  });
}`,
  "agent/extensions/ide/lib/list-picker.ts": `
import type { Component } from "@mariozechner/pi-tui";
import { Key, matchesKey } from "@mariozechner/pi-tui";
import { createSplitPanel } from "../split-panel";
import { truncateAnsi, ensureWidth } from "./text-utils";
import { applyFocusedStyle } from "./style-utils";
import { calculateDimensions } from "../split-panel/layout";
import { renderSplitPanel } from "../split-panel/border";

type ListPickerTui = {
  terminal: { rows: number; columns: number };
  requestRender: () => void;
};

export interface ListPickerConfig<T> {
  title: string | (() => string);
  loadItems: (query: string) => Promise<T[]>;
  filterItems?: (items: T[], query: string) => T[];
  formatItem: (item: T, width: number, theme: unknown) => string;
  loadPreview?: (item: T) => Promise<string[]>;
  actions?: ListPickerAction<T>[];
}

export interface ListPickerAction<T> {
  key: string;
  label: string;
  handler: (item: T) => void | Promise<void>;
}

export interface ListPickerComponent {
  render: (width: number) => string[];
  handleInput: (data: string) => void;
  dispose: () => void;
  setPreview: (lines: string[]) => void;
}

export class ListPickerComponent implements Component {
  private items: unknown[] = [];
  private filteredItems: unknown[] = [];
  private focusedIndex = 0;
  private sourceLines: string[] = [];
  private loading = true;

  constructor(
    private tui: ListPickerTui,
    private theme: Record<string, unknown>,
    private config: ListPickerConfig<unknown>,
  ) {
    void this.loadItems();
  }

  private async loadItems(): Promise<void> {
    try {
      this.items = await this.config.loadItems("");
      this.filteredItems = [...this.items];
      this.loading = false;
      if (this.filteredItems.length > 0) {
        void this.loadPreview(this.filteredItems[0]);
      }
    } catch (err) {
      console.error("Failed to load items", err);
    }
  }

  private async loadPreview(item: unknown): Promise<void> {
    if (!this.config.loadPreview) return;
    this.sourceLines = await this.config.loadPreview(item);
  }

  render(width: number): string[] {
    const dims = calculateDimensions(this.tui.terminal.rows, width);
    const leftItems = this.getItemRows(dims.leftW, dims.contentH);
    const rightItems = this.getSourceRows(dims.rightW, dims.contentH);
    return renderSplitPanel(this.theme, dims, { left: leftItems, right: rightItems });
  }

  private getItemRows(width: number, height: number): string[] {
    if (this.loading) return [" Loading..."];
    const rows: string[] = [];
    for (let i = 0; i < height && i < this.filteredItems.length; i++) {
      const item = this.filteredItems[i];
      const formatted = this.config.formatItem(item, width - 1, this.theme);
      const isFocused = i === this.focusedIndex;
      const line = isFocused
        ? applyFocusedStyle(this.theme, " " + formatted)
        : ensureWidth(" " + formatted, width);
      rows.push(line);
    }
    return rows;
  }

  private getSourceRows(width: number, _height: number): string[] {
    const rows: string[] = [];
    for (const line of this.sourceLines.slice(0, _height)) {
      rows.push(ensureWidth(" " + line, width));
    }
    return rows;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) this.focusedIndex = Math.max(0, this.focusedIndex - 1);
    else if (matchesKey(data, Key.down)) this.focusedIndex = Math.min(this.filteredItems.length - 1, this.focusedIndex + 1);
  }

  dispose(): void {
    this.items = [];
    this.filteredItems = [];
    this.sourceLines = [];
  }
}

export function createListPicker<T>(options: {
  pi: unknown;
  tui: ListPickerTui;
  theme: Record<string, unknown>;
  config: ListPickerConfig<T>;
}): ListPickerComponent {
  const { pi: _pi, tui, theme, config } = options;
  return new ListPickerComponent(tui, theme, config);
}`,
  "agent/extensions/ide/lib/split-panel/index.ts": `
import type { Terminal } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { renderSplitPanel } from "./border";
import { calculateDimensions } from "./layout";

export interface SplitPanelState {
  leftItems: string[];
  rightItems: string[];
  title: string;
  helpText: string;
  focus: "left" | "right";
}

export class SplitPanel {
  private state: SplitPanelState;

  constructor(private terminal: Terminal, private theme: Theme) {
    this.state = {
      leftItems: [],
      rightItems: [],
      title: "",
      helpText: "",
      focus: "left",
    };
  }

  setLeftItems(items: string[]): void {
    this.state.leftItems = items;
  }

  setRightItems(items: string[]): void {
    this.state.rightItems = items;
  }

  setTitle(title: string): void {
    this.state.title = title;
  }

  setHelpText(text: string): void {
    this.state.helpText = text;
  }

  setFocus(focus: "left" | "right"): void {
    this.state.focus = focus;
  }

  render(width: number): string[] {
    const dims = calculateDimensions(this.terminal.rows, width);
    return renderSplitPanel(
      this.theme,
      { leftTitle: this.state.title, rightTitle: "", helpText: this.state.helpText },
      dims,
      { left: this.state.leftItems, right: this.state.rightItems },
    );
  }
}

export function createSplitPanel(terminal: Terminal, theme: Theme): SplitPanel {
  return new SplitPanel(terminal, theme);
}`,
  "agent/extensions/ide/lib/split-panel/renderer.ts": `
import type { Theme } from "@mariozechner/pi-coding-agent";
import { renderBorder } from "./border";

export class PanelRenderer {
  private leftContent: string[] = [];
  private rightContent: string[] = [];

  constructor(private theme: Theme) {}

  setLeft(content: string[]): void {
    this.leftContent = content;
  }

  setRight(content: string[]): void {
    this.rightContent = content;
  }

  render(width: number, height: number): string[] {
    const leftW = Math.floor(width / 2);
    const rightW = width - leftW;
    const result: string[] = [];
    for (let i = 0; i < height; i++) {
      const leftLine = this.leftContent[i] || "";
      const rightLine = this.rightContent[i] || "";
      result.push(leftLine.padEnd(leftW) + "│" + rightLine.padEnd(rightW));
    }
    return result;
  }

  handleInput(key: string): void {
    if (key === "left") this.focus = "left";
    if (key === "right") this.focus = "right";
  }
}

export function renderSplitPanel(
  lines: string[][],
  theme: Theme,
): string[] {
  const maxWidth = Math.max(...lines.map((col) => col.join("\n").length));
  return lines[0].map((line, i) => line.padEnd(maxWidth));
}`,
  "agent/extensions/ide/components/files/component.ts": `
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { createListPicker } from "../../lib/list-picker";
import { createFilePreviewLoader } from "../../lib/preview-utils";
import { getFileIcon } from "../../lib/file-icons";
import type { FileInfo } from "./types";

export function rg(pi: ExtensionAPI, cwd: string, query: string): Promise<FileInfo[]> {
  return pi.exec("rg", ["--files", "-g", query]).then((r) =>
    r.stdout.split("\n").filter(Boolean).map((p) => ({ path: p })),
  );
}

export function createFilesComponent(options: {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  done: (result: FileInfo | null) => void;
  ctx: { cwd: string };
}) {
  const { pi, tui, theme, done, ctx } = options;
  return createListPicker({
    pi, tui, theme, done, initialQuery: "",
    config: {
      title: () => "Files",
      loadItems: (q) => rg(pi, ctx.cwd, q),
      formatItem: (f, w, t) => getFileIcon((f as FileInfo).path),
      loadPreview: createFilePreviewLoader(ctx.cwd, theme),
    },
  });
}`,
  "agent/extensions/ide/components/symbols/types.ts": `
export type SymbolTypeFilter = "all" | "class" | "function" | "method" | "enum";

export enum FocusState {
  Idle = "idle",
  Loading = "loading",
  Ready = "ready",
  Error = "error",
}

export enum SymbolType {
  Class = "c",
  Function = "f",
  Method = "m",
  Enum = "e",
  Interface = "i",
  Variable = "v",
  Constant = "const",
  TypeAlias = "t",
}

export interface SymbolInfo {
  id: string;
  name: string;
  type: string;
  path: string;
  startLine: number;
  endLine: number;
}

export interface SymbolResult {
  symbol: SymbolInfo;
  action?: string;
}`,
  "agent/extensions/ide/components/changes/state.ts": `
import type { Change } from "../../types";

export enum FocusState {
  Changes = "changes",
  Details = "details",
}

export interface ChangesState {
  items: Change[];
  focusedIndex: number;
  loading: boolean;
  error: string | null;
  focus: FocusState;
}

export function createInitialState(): ChangesState {
  return { items: [], focusedIndex: 0, loading: true, error: null, focus: FocusState.Changes };
}`,
  "agent/extensions/ide/lib/file-preview.ts": `
import type { Theme } from "@mariozechner/pi-coding-agent";

export async function loadFilePreviewWithShiki(
  path: string,
  content: string,
  theme: Theme,
): Promise<string[]> {
  const ext = path.split(".").pop();
  const lines = content.split("\\n");
  return lines.slice(0, getPreviewLineCount(ext));
}`,
  "agent/extensions/nix/nix.test.ts": `
import { describe, it, expect, vi } from "vitest";

vi.mock("node:fs/promises");

import { createNixComponent } from "./nix";

describe("nix search", () => {
  it("returns formatted results", async () => {
    const result = await searchPackages("hello");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("hello");
  });
});`,
  "agent/extensions/ide/components/symbols/component.ts": `
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { KeybindingsManager } from "@mariozechner/pi-coding-agent";
import { createListPicker } from "../../lib/list-picker";
import { formatSymbolListEntry } from "../../lib/symbol-utils";
import { createFilePreviewLoader } from "../../lib/preview-utils";
import type { SymbolInfo, SymbolResult, SymbolTypeFilter } from "./types";

export function querySymbols(
  pi: ExtensionAPI,
  cwd: string,
  query: string,
  typeFilter?: SymbolTypeFilter,
): Promise<SymbolInfo[]> {
  const args = ["query", query, "--format", "ai"];
  if (typeFilter && typeFilter !== "all") args.push("--type", typeFilter);
  return pi.exec("cm", args, { cwd }).then((r) => {
    if (r.code !== 0) return [];
    return r.stdout
      .split("\n")
      .filter((l) => l.includes("|"))
      .map(parseSymbolLine)
      .filter(Boolean) as SymbolInfo[];
  });
}

function parseSymbolLine(line: string): SymbolInfo | null {
  const match = /^(.+)\\|([a-z_]+)\\|(\\.[^|]+)\\|(\\d+-\\d+)$/.exec(line);
  if (!match) return null;
  const [startStr, endStr] = match[4].split("-");
  return {
    id: match[3] + ":" + startStr,
    name: match[1],
    type: match[2],
    path: match[3],
    startLine: Number.parseInt(startStr, 10),
    endLine: Number.parseInt(endStr, 10),
  };
}

export function createSymbolsComponent(options: {
  pi: ExtensionAPI;
  tui: { terminal: { rows: number }; requestRender: () => void };
  theme: Theme;
  keybindings: KeybindingsManager;
  done: (result: SymbolResult | null) => void;
  initialQuery: string;
  ctx: { cwd: string };
}) {
  const { pi, tui, theme, keybindings, done, initialQuery, ctx } = options;
  const currentType = { value: "class" as SymbolTypeFilter };

  return createListPicker({
    pi,
    tui,
    theme,
    keybindings,
    done: (item: unknown) => item ? done({ symbol: item as SymbolInfo }) : done(null),
    initialQuery,
    config: {
      title: () => "Symbols [" + currentType.value + "]",
      loadItems: (q) => querySymbols(pi, ctx.cwd, q, currentType.value),
      formatItem: (s, w, t) => formatSymbolListEntry(t, s as SymbolInfo),
      loadPreview: createFilePreviewLoader(ctx.cwd, theme),
    },
  });
}`,
  "agent/extensions/ide/lib/symbol-utils.ts": `
import type { Theme } from "@mariozechner/pi-coding-agent";

export function formatSymbolListEntry(
  theme: Theme,
  symbol: { name: string; path: string; startLine: number },
): string {
  const icon = getSymbolIcon(symbol.type);
  return \\" \${icon} \\$\{symbol.name\} \\$\{symbol.path}:\${symbol.startLine}\";
}`,
  "agent/extensions/gh/index.ts": `
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function register(pi: ExtensionAPI) {
  pi.registerCommand("gh-pr", {
    description: "List pull requests",
    async handler(_args, ctx) {
      const prs = await ghPrList(ctx);
      return formatPrTable(prs);
    },
  });
}`,
  "agent/shared/tool-utils.ts": `
import { spawn } from "node:child_process";

export async function runTool(
  tool: string,
  args: string[],
): Promise<string> {
  const child = spawn(tool, args);
  return new Promise((resolve) => {
    child.stdout.on("data", (d) => resolve(d.toString()));
  });
}`,
  "agent/extensions/usage/usage.test.ts": `
import { describe, it, expect } from "vitest";
import { formatUsageStats } from "./usage";

describe("usage formatting", () => {
  it("formats provider data correctly", () => {
    const stats = { sessions: 5, tokens: 12000 };
    expect(formatUsageStats(stats)).toContain("5 sessions");
  });
});`,
  "src/main.ts": `
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function register(pi: ExtensionAPI) {
  pi.registerCommand("main", {
    description: "Main entry point",
    async handler(_args, ctx) {
      console.log("Hello");
    },
  });
}`,
  "src/index.ts": `
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function register(pi: ExtensionAPI) {
  pi.registerCommand("test", {
    description: "Test command",
    async handler(_args, ctx) {
      console.log("Hello");
    },
  });
}`,
  "src/utils/helper.ts": `
export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + "…" : str;
}

export function padRight(str: string, width: number): string {
  return str.padEnd(width);
}`,
  "a.ts": `
export function hello(): void {
  console.log("Hello");
}
`,
  "agent/extensions/ide/components/split-panel/border.ts": `
import type { Theme } from "@mariozechner/pi-coding-agent";

export function renderBorder(theme: Theme): string {
  return theme.colors.border;
}`,
};

const TS_CONTENT = TS_FILES["src/main.ts"]!;

const TSX_CONTENT = `
import { useState } from "react";

export function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="app">
      <h1>Counter</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  );
}`;

const NIX_CONTENT = `
{ pkgs ? import <nixpkgs> {} }:
{
  hello = pkgs.hello;
}
`;

const YAML_CONTENT = `
version: "3"
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
  const p = typeof path === "string" ? path : path.toString();
  for (const [key, content] of Object.entries(TS_FILES)) {
    if (p.includes(key)) return content;
  }
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  const base = p.split("/").pop() ?? "";
  const byName = FILENAME_CONTENTS[base];
  if (byName) return byName;
  const byExt = EXTENSION_CONTENTS[ext];
  if (byExt) return byExt;

  const actual = await import("node:fs/promises");
  return actual.readFile(
    path,
    _opts as Parameters<typeof actual.readFile>[1],
  ) as unknown as string;
}
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
