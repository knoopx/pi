import type { Terminal } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Change } from "../types";

// ─── Test terminal (implements Terminal interface) ────────────────────────

export class TestTerminal implements Terminal {
  written: string[] = [];
  inputCallback?: (data: string) => void;
  resizeCallback?: () => void;

  constructor(
    public width = 120,
    public height = 30,
  ) {}

  get columns(): number {
    return this.width;
  }

  get rows(): number {
    return this.height;
  }

  get kittyProtocolActive(): boolean {
    return false;
  }

  start(onInput: (data: string) => void, onResize: () => void): void {
    this.inputCallback = onInput;
    this.resizeCallback = onResize;
  }

  stop(): void {}
  drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {
    return Promise.resolve();
  }
  write(data: string): void {
    this.written.push(data);
  }
  moveBy(_lines: number): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(_title: string): void {}
}

// ─── Mock data helpers ────────────────────────────────────────────────────

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

// ─── Mock theme helpers ────────────────────────────────────────────────────

/** Create a minimal mock Theme for snapshot tests. */
export function createMockTheme(): Theme {
  const fg = (color: string, text: string) => `[${color}:${text}]`;
  return {
    fg,
    bg: (c: string, t: string) => `[BG:${c}:${t}]`,
    bold: (t: string) => `**${t}**`,
    inverse: (t: string) => `[I:${t}]`,
  } as unknown as Theme;
}

/** Strip ANSI escape sequences from a string. */
export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\[?.*?m/g, "");
}
