import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Terminal } from "@earendil-works/pi-tui";

export class TestTerminal implements Terminal {
  private _columns: number;
  private _rows: number;

  constructor(columns = 120, rows = 30) {
    this._columns = columns;
    this._rows = rows;
  }

  get columns(): number {
    return this._columns;
  }

  set columns(value: number) {
    this._columns = value;
  }

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

const BG_KEYS = new Set([
  "selectedBg",
  "customMessageBg",
  "toolErrorBg",
  "toolPendingBg",
  "toolSuccessBg",
  "userMessageBg",
]);

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

function parseHexRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return [r, g, b];
}

function fgAnsi(hex: string): string {
  const [r, g, b] = parseHexRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function bgAnsi(hex: string): string {
  const [r, g, b] = parseHexRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

export function createMockTheme(): Theme {
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
    bold: (t: string) => `\x1b[1m${t}\x1b[22m`,
    italic: (t: string) => `\x1b[3m${t}\x1b[23m`,
    underline: (t: string) => `\x1b[4m${t}\x1b[24m`,
    inverse: (t: string) => `\x1b[7m${t}\x1b[27m`,
    strikethrough: (t: string) => `\x1b[9m${t}\x1b[29m`,
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
