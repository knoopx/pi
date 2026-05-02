import chalk from "chalk";
import { expect, vi } from "vitest";
import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import type { TUI, Terminal } from "@mariozechner/pi-tui";
import { parseHexRgb } from "./split-panel/utils";
import type { Change } from "./types";
import { createMockExtensionAPI } from "../../../shared/testing/test-utils";
interface ChalkStyler {
  bold(t: string): string;
  italic(t: string): string;
  underline(t: string): string;
  inverse(t: string): string;
  strikethrough(t: string): string;
}

// Real Theme delegates to chalk, which silently passes through on non-TTY.
// Force truecolor so mock output matches TTY behavior.
const c = (chalk.constructor as unknown as (...args: unknown[]) => ChalkStyler)(
  {
    level: 3,
  },
);
export class TestTerminal implements Terminal {
  private _columns: number;
  private _rows: number;

  constructor(columns = 120, rows = 30) {
    this._columns = columns;
    this._rows = rows;
  }

  // fallow-ignore-next-line unused-class-members — accessed via type assertion in tests
  get columns(): number {
    return this._columns;
  }

  set columns(value: number) {
    this._columns = value;
  }

  // fallow-ignore-next-line unused-class-members — accessed via type assertion in tests
  get rows(): number {
    return this._rows;
  }

  set rows(value: number) {
    this._rows = value;
  }

  start(_onInput: (data: string) => void, _onResize: () => void): void {}
  stop(): void {}
  async drainInput(): Promise<void> {}
  write(_data: string): void {}
  get kittyProtocolActive(): boolean {
    return false;
  }
  moveBy(_lines: number): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(_title: string): void {}
  setProgress(_active: boolean): void {}
}
export function createMockChange(overrides?: Partial<Change>): Change {
  return {
    changeId: "a",
    commitId: "",
    description: "x",
    author: "",
    timestamp: "",
    empty: false,
    immutable: false,
    parentIds: [],
    ...overrides,
  };
}
function resolveColor(
  value: string | number,
  vars: Record<string, string | number>,
): string | number {
  if (
    typeof value === "number" ||
    typeof value !== "string" ||
    value.startsWith("#")
  ) {
    return value;
  }
  const resolved = vars[value];
  if (resolved === undefined) {
    throw new Error(`Unknown theme variable: ${value}`);
  }
  return resolveColor(resolved, vars);
}
function fgAnsi(hex: string): string {
  const [r, g, b] = parseHexRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}
function bgAnsi(hex: string): string {
  const [r, g, b] = parseHexRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}
const BG_KEYS = new Set([
  "selectedBg",
  "userMessageBg",
  "customMessageBg",
  "toolPendingBg",
  "toolSuccessBg",
  "toolErrorBg",
]);
export function createMockTheme(): Theme {
  // Inline the custom.json palette so tests stay fully self-contained.
  const vars: Record<string, string> = {
    base00: "#191033",
    base01: "#211641",
    base02: "#32245d",
    base03: "#4c3e76",
    base04: "#6e6194",
    base05: "#f8f8f8",
    base06: "#f1f0f4",
    base07: "#fad000",
    base08: "#ff628c",
    base09: "#ffb454",
    base0A: "#fad000",
    base0B: "#a5ff90",
    base0C: "#80fcff",
    base0D: "#fad000",
    base0E: "#faefa5",
    base0F: "#fb94ff",
  };
  const rawColors: Record<string, string> = {
    accent: "base0D",
    bashMode: "base08",
    border: "base03",
    borderAccent: "base0D",
    borderMuted: "base02",
    customMessageBg: "base01",
    customMessageLabel: "base0E",
    customMessageText: "base05",
    dim: "base03",
    error: "base08",
    mdCode: "base0B",
    mdCodeBlock: "base05",
    mdCodeBlockBorder: "base03",
    mdHeading: "base0D",
    mdHr: "base03",
    mdLink: "base0C",
    mdLinkUrl: "base03",
    mdListBullet: "base0D",
    mdQuote: "base04",
    mdQuoteBorder: "base03",
    muted: "base04",
    selectedBg: "base02",
    success: "base0B",
    syntaxComment: "base03",
    syntaxFunction: "base0D",
    syntaxKeyword: "base0E",
    syntaxNumber: "base09",
    syntaxOperator: "base0C",
    syntaxPunctuation: "base06",
    syntaxString: "base0B",
    syntaxType: "base0A",
    syntaxVariable: "base08",
    text: "base05",
    thinkingHigh: "base0E",
    thinkingLow: "base0D",
    thinkingMedium: "base0C",
    thinkingMinimal: "base04",
    thinkingOff: "base03",
    thinkingText: "base04",
    thinkingXhigh: "base0F",
    toolDiffAdded: "base0B",
    toolDiffContext: "base04",
    toolDiffRemoved: "base08",
    toolErrorBg: "base01",
    toolOutput: "base06",
    toolPendingBg: "base01",
    toolSuccessBg: "base01",
    toolTitle: "base0D",
    userMessageBg: "base01",
    userMessageText: "base05",
    warning: "base0A",
  };
  const resolved: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawColors)) {
    resolved[key] = resolveColor(value, vars) as string;
  }
  const fgMap = new Map<string, string>();
  const bgMap = new Map<string, string>();

  for (const [key, hex] of Object.entries(resolved)) {
    if (BG_KEYS.has(key)) {
      bgMap.set(key, bgAnsi(hex));
    } else {
      fgMap.set(key, fgAnsi(hex));
    }
  }

  return {
    name: "nix-defaults",
    fg: (color: string, text: string) => {
      const ansi = fgMap.get(color);
      if (!ansi) throw new Error(`Unknown theme color: ${color}`);
      return `${ansi}${text}\x1b[39m`;
    },
    bg: (color: string, text: string) => {
      const ansi = bgMap.get(color);
      if (!ansi) throw new Error(`Unknown theme background color: ${color}`);
      return `${ansi}${text}\x1b[49m`;
    },
    bold: (t: string) => c.bold(t),
    italic: (t: string) => c.italic(t),
    underline: (t: string) => c.underline(t),
    inverse: (t: string) => c.inverse(t),
    strikethrough: (t: string) => c.strikethrough(t),
    getFgAnsi: (color: string) => {
      const ansi = fgMap.get(color);
      if (!ansi) throw new Error(`Unknown theme color: ${color}`);
      return ansi;
    },
    getBgAnsi: (color: string) => {
      const ansi = bgMap.get(color);
      if (!ansi) throw new Error(`Unknown theme background color: ${color}`);
      return ansi;
    },
  } as unknown as Theme;
}
export function createMockPi(overrides?: Partial<ExtensionAPI>): ExtensionAPI {
  return {
    ...createMockExtensionAPI(),
    getFlag: vi.fn().mockReturnValue(null),
    exec: vi.fn().mockResolvedValue({
      code: 0,
      stdout: "",
      stderr: "",
    }),
    ...overrides,
  } as unknown as ExtensionAPI;
}
export function createMockTui() {
  const terminal = new TestTerminal(120, 30);
  return {
    terminal,
    requestRender: vi.fn(),
    setFocus: vi.fn(),
  } as unknown as TUI;
}

export function createComponentFixture<T extends Record<string, unknown>>(
  factory: (options: T) => { render: (cols: number) => string[] },
  options: Partial<T> & {
    pi?: ExtensionAPI;
    tui?: ReturnType<typeof createMockTui>;
    theme?: ReturnType<typeof createMockTheme>;
  },
): {
  component: ReturnType<typeof factory>;
  mockPi: ExtensionAPI;
  tui: ReturnType<typeof createMockTui>;
} {
  const mockPi = options.pi ?? createMockPi();
  const tui = options.tui ?? createMockTui();
  const theme = options.theme ?? createMockTheme();
  const component = factory({
    ...options,
    pi: mockPi,
    tui,
    theme,
  } as unknown as T) as ReturnType<typeof factory>;
  return { component, mockPi, tui };
}

export async function createComponentTest<T extends Record<string, unknown>>(
  factory: (options: T) => { render: (cols: number) => string[] },
  options: Omit<Partial<T>, "pi" | "tui"> & {
    stdout?: string;
    execRouter?: (
      cmd: string,
      args?: string[],
    ) => Promise<{ code: number; stdout: string; stderr: string }>;
  },
): Promise<{
  component: ReturnType<typeof factory>;
  tui: ReturnType<typeof createMockTui>;
}> {
  const mockPi = createMockPi({
    exec: options.execRouter
      ? vi.fn().mockImplementation(options.execRouter)
      : vi.fn().mockResolvedValue({
          code: 0,
          stdout: options.stdout ?? "",
          stderr: "",
        }),
  });
  const { component, tui } = createComponentFixture(factory, {
    ...options,
    pi: mockPi,
  } as Partial<T> & {
    pi?: ExtensionAPI;
    tui?: ReturnType<typeof createMockTui>;
    theme?: ReturnType<typeof createMockTheme>;
  });
  await new Promise((r) => setTimeout(r, 50));
  return { component, tui };
}

export function snapshotRender(component: {
  render: (cols: number) => string[];
}): void {
  const result = component.render(120);
  expect(result.join("\n")).toMatchSnapshot();
}

interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}
interface MockExecPi {
  pi: ExtensionAPI;
  execMock: ReturnType<
    typeof vi.fn<(...args: unknown[]) => Promise<ExecResult>>
  >;
}
export function createMockExecPi(): MockExecPi {
  const execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
  return {
    execMock,
    pi: { exec: execMock } as unknown as ExtensionAPI,
  };
}
export interface ErrorFixtureOptions<T extends Record<string, unknown>> {
  componentFactory: (options: T) => { render: (cols: number) => string[] };
  config: Partial<T> & {
    pi?: ExtensionAPI;
    tui?: ReturnType<typeof createMockTui>;
    theme?: ReturnType<typeof createMockTheme>;
  };
  stderr?: string;
}

export async function createErrorFixture<T extends Record<string, unknown>>(
  options: ErrorFixtureOptions<T>,
): Promise<string[]> {
  const { componentFactory, config, stderr = "command failed" } = options;
  const mockPi = createMockPi({
    exec: vi.fn().mockResolvedValue({
      code: 1,
      stdout: "",
      stderr,
    }),
  });
  const { component } = createComponentFixture(componentFactory, {
    ...config,
    pi: mockPi,
  });
  await new Promise((r) => setTimeout(r, 50));
  return component.render(120);
}

interface ExecRoute {
  command: string;
  args: string[];
  result: ExecResult;
}
export function createMockExecPiWithRoutes(routes: ExecRoute[]): MockExecPi {
  const execMock = vi
    .fn<(...args: unknown[]) => Promise<ExecResult>>()
    .mockImplementation(
      (command: unknown, args: unknown): Promise<ExecResult> => {
        const cmd = String(command);
        const argList = (args as string[]) ?? [];

        for (const route of routes) {
          if (cmd !== route.command) continue;
          const match = route.args.every((a, i) => argList[i] === a);
          if (match) return Promise.resolve(route.result);
        }

        return Promise.resolve({
          code: 1,
          stdout: "",
          stderr: "unexpected call",
        });
      },
    );

  return {
    execMock,
    pi: { exec: execMock } as unknown as ExtensionAPI,
  };
}
