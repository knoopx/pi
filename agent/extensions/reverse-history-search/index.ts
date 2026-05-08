import { fuzzyMatch } from "../../shared/matching/fuzzy";

import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";
import type { TUI } from "@earendil-works/pi-tui";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { renderHistoryPage } from "./render";
export interface HistoryEntry {
  content: string;
  preview?: string;
  timestamp: number;
  type: "command" | "message";
}
interface SessionMessageLine {
  role?: unknown;
  timestamp?: unknown;
  command?: unknown;
  content?: unknown;
}
interface SessionLine {
  type?: unknown;
  timestamp?: unknown;
  cwd?: unknown;
  message?: unknown;
}
function asSessionMessage(message: unknown): SessionMessageLine | null {
  if (typeof message !== "object" || message === null) return null;

  return message as SessionMessageLine;
}
const addHistoryEntry = (
  history: HistoryEntry[],
  seen: Set<string>,
  entry: HistoryEntry,
): void => {
  const content = entry.content.trim();
  if (!content) return;
  const key = `${entry.type}:${content}`;
  if (seen.has(key)) return;

  seen.add(key);
  const firstLine = content.split("\n")[0]?.trim() ?? content;
  history.push({ ...entry, content, preview: firstLine });
};
const extractBangCommandsFromUserText = (text: string): string[] => {
  const commands: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("!")) continue;
    const command = line.replace(/^!+/, "").trim();
    if (command) commands.push(command);
  }

  return commands;
};
const getUserTextFromContent = (content: unknown): string => {
  if (!Array.isArray(content)) return "";
  const parts = content
    .map((block) => {
      if (typeof block !== "object" || block === null) return "";
      const typedBlock = block as { type?: unknown; text?: unknown };
      return typedBlock.type === "text" && typeof typedBlock.text === "string"
        ? typedBlock.text
        : "";
    })
    .filter((part) => part.length > 0);

  return parts.join("\n").trim();
};
const isPathMatch = (sessionCwd: string, targetCwd: string): boolean => {
  return (
    sessionCwd === targetCwd ||
    sessionCwd.startsWith(`${targetCwd}/`) ||
    targetCwd.startsWith(`${sessionCwd}/`)
  );
};
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
function getSessionCwd(content: string): string | null {
  const lines = content.trim().split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const raw = JSON.parse(line) as unknown;
      if (typeof raw !== "object" || raw === null) continue;
      const parsed = raw as { type?: string; cwd?: string };
      if (parsed.type === "session" && parsed.cwd) return parsed.cwd;
    } catch {
      continue;
    }
  }
  return null;
}
function extractTimestamp(
  entry: SessionLine,
  message: SessionMessageLine,
): number {
  if (typeof entry.timestamp === "string")
    return new Date(entry.timestamp).getTime();
  if (typeof entry.timestamp === "number") return entry.timestamp;
  if (typeof message.timestamp === "number") return message.timestamp;
  return Date.now();
}
interface ProcessSessionFileOpts {
  targetCwd: string;
  cutoffTimestamp: number;
  history: HistoryEntry[];
  seen: Set<string>;
}
function processSessionFile(
  fullPath: string,
  opts: ProcessSessionFileOpts,
): void {
  try {
    const content = readFileSync(fullPath, "utf-8");
    if (!shouldProcessSession(content, opts.targetCwd)) return;
    const lines = content.trim().split("\n");
    for (const line of lines) {
      processSessionLine(line, opts);
    }
  } catch {}
}
function shouldProcessSession(content: string, targetCwd: string): boolean {
  const sessionCwd = getSessionCwd(content);
  if (!sessionCwd) return false;
  return isPathMatch(sessionCwd, targetCwd);
}
function processSessionLine(line: string, opts: ProcessSessionFileOpts): void {
  if (!line.trim()) return;
  try {
    const entry = JSON.parse(line) as SessionLine;
    if (entry.type !== "message") return;
    const message = asSessionMessage(entry.message);
    if (!message) return;
    const timestamp = extractTimestamp(entry, message);
    if (timestamp < opts.cutoffTimestamp) return;

    processMessageEntry(message, timestamp, opts.history, opts.seen);
  } catch {}
}
function processMessageEntry(
  message: SessionMessageLine,
  timestamp: number,
  history: HistoryEntry[],
  seen: Set<string>,
): void {
  if (message.role === "bashExecution" && typeof message.command === "string") {
    addHistoryEntry(history, seen, {
      content: message.command,
      timestamp,
      type: "command",
    });
    return;
  }

  if (message.role === "user") {
    const text = getUserTextFromContent(message.content);
    if (!text) return;

    addHistoryEntry(history, seen, {
      content: text,
      timestamp,
      type: "message",
    });

    for (const command of extractBangCommandsFromUserText(text)) {
      addHistoryEntry(history, seen, {
        content: command,
        timestamp,
        type: "command",
      });
    }
  }
}
function walkDir(
  dir: string,
  opts: {
    targetCwd: string;
    cutoffTimestamp: number;
    history: HistoryEntry[];
    seen: Set<string>;
  },
): void {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) walkDir(fullPath, opts);
        else if (
          entry.endsWith(".jsonl") &&
          stat.mtimeMs >= opts.cutoffTimestamp
        )
          processSessionFile(fullPath, opts);
      } catch {}
    }
  } catch {}
}
const loadSessionHistoryForCwd = (targetCwd: string): HistoryEntry[] => {
  const history: HistoryEntry[] = [];
  const seen = new Set<string>();
  const cutoffTimestamp = Date.now() - ONE_WEEK_MS;

  try {
    const sessionsDir = join(homedir(), ".pi", "agent", "sessions");
    walkDir(sessionsDir, { targetCwd, cutoffTimestamp, history, seen });
  } catch {}

  return history.sort((a, b) => b.timestamp - a.timestamp);
};

interface HistoryFilter {
  name: string;
  type: "command" | "message";
}
const HISTORY_FILTERS: HistoryFilter[] = [
  { name: "Messages", type: "message" },
  { name: "Commands", type: "command" },
];

const keyHandlers: Record<string, (self: HistorySearchComponent) => void> = {
  escape: (self) => self.handleEscape(),
  enter: (self) => self.handleEnter(),
  pageUp: (self) => self.handlePageUp(),
  pageDown: (self) => self.handlePageDown(),
  home: (self) => self.handleHome(),
  end: (self) => self.handleEnd(),
  up: (self) => self.handleUp(),
  down: (self) => self.handleDown(),
  "ctrl+/": (self) => self.cycleFilter(1),
  backspace: (self) => self.handleBackspace(),
  delete: (self) => self.handleBackspace(),
};

const allKeys = Object.keys(keyHandlers);

export class HistorySearchComponent {
  private allHistory: HistoryEntry[];
  private filteredHistory: HistoryEntry[];
  private query = "";
  private selectedIndex = 0;
  private filterIndex = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];

  public onSelect?: (entry: HistoryEntry) => void;
  public onCancel?: () => void;

  constructor(
    private theme: Theme,
    history: HistoryEntry[],
  ) {
    this.allHistory = history;
    this.filteredHistory = history;
  }

  getFilterName(): string {
    return HISTORY_FILTERS[this.filterIndex]?.name ?? "Messages";
  }

  private getPageOffset(): number {
    return 10;
  }

  handleInput(data: string): void {
    for (const key of allKeys) {
      if (matchesKey(data, key as import("@earendil-works/pi-tui").KeyId)) {
        keyHandlers[key](this);
        return;
      }
    }

    if (data.length === 1 && data.charCodeAt(0) >= 32)
      this.handleCharacter(data);
  }

  handleEscape(): void {
    this.onCancel?.();
  }

  handleEnter(): void {
    if (this.filteredHistory.length > 0)
      this.onSelect?.(this.filteredHistory[this.selectedIndex]);
  }

  handleUp(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.invalidate();
    }
  }

  handleDown(): void {
    if (this.selectedIndex < this.filteredHistory.length - 1) {
      this.selectedIndex++;
      this.invalidate();
    }
  }

  handlePageUp(): void {
    const offset = this.getPageOffset();
    const newIndex = Math.max(0, this.selectedIndex - offset);
    if (newIndex !== this.selectedIndex) {
      this.selectedIndex = newIndex;
      this.invalidate();
    }
  }

  handlePageDown(): void {
    const offset = this.getPageOffset();
    const maxIndex = this.filteredHistory.length - 1;
    const newIndex = Math.min(maxIndex, this.selectedIndex + offset);
    if (newIndex !== this.selectedIndex) {
      this.selectedIndex = newIndex;
      this.invalidate();
    }
  }

  handleHome(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex = 0;
      this.invalidate();
    }
  }

  handleEnd(): void {
    const maxIndex = this.filteredHistory.length - 1;
    if (this.selectedIndex < maxIndex) {
      this.selectedIndex = maxIndex;
      this.invalidate();
    }
  }

  cycleFilter(direction: 1 | -1): void {
    this.filterIndex =
      (this.filterIndex + direction + HISTORY_FILTERS.length) %
      HISTORY_FILTERS.length;
    this.selectedIndex = 0;
    this.updateFilter();
  }

  handleBackspace(): void {
    if (this.query.length > 0) {
      this.query = this.query.slice(0, -1);
      this.updateFilter();
    }
  }

  private handleCharacter(char: string): void {
    this.query += char;
    this.updateFilter();
  }

  private updateFilter(): void {
    const currentFilter = HISTORY_FILTERS[this.filterIndex];
    const matchesQuery = (entry: HistoryEntry): boolean =>
      this.query === "" || fuzzyMatch(entry.content, this.query);

    const matchesType = (entry: HistoryEntry): boolean =>
      entry.type === currentFilter.type;

    this.filteredHistory = this.allHistory.filter(
      (entry) => matchesQuery(entry) && matchesType(entry),
    );

    if (this.selectedIndex >= this.filteredHistory.length)
      this.selectedIndex = Math.max(0, this.filteredHistory.length - 1);

    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    const filterName = this.getFilterName();
    const lines = renderHistoryPage(
      this.filteredHistory,
      this.selectedIndex,
      width,
      this.query,
      this.theme,
      filterName,
    );
    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
export function makeHistorySearchRenderer(
  theme: Theme,
  history: HistoryEntry[],
  done: (result: HistoryEntry | null) => void,
  tuiRef: TUI,
): {
  render(w: number): string[];
  invalidate(): void;
  handleInput(data: string): void;
} {
  const component = new HistorySearchComponent(theme, history);

  component.onSelect = (entry) => {
    done(entry);
  };
  component.onCancel = () => {
    done(null);
  };

  return {
    render(w: number) {
      return component.render(w);
    },
    invalidate() {
      component.invalidate();
    },
    handleInput(data: string) {
      component.handleInput(data);
      tuiRef.requestRender();
    },
  };
}
export default function (pi: ExtensionAPI): void {
  pi.registerShortcut("ctrl+r", {
    description:
      "Reverse history search (user messages and commands from sessions in current directory)",
    async handler(ctx: ExtensionContext) {
      if (!ctx.hasUI) return;
      const history = loadSessionHistoryForCwd(ctx.cwd);
      if (history.length === 0) {
        ctx.ui.notify("No history found", "warning");
        return;
      }
      const result = await ctx.ui.custom<HistoryEntry | null>(
        (tuiRef, themeRef, _kb, doneRef) =>
          makeHistorySearchRenderer(themeRef, history, doneRef, tuiRef),
      );

      if (!result) return;
      const content = result.content.trim().replace(/\n+$/, "");
      if (result.type === "command") {
        ctx.ui.setEditorText(`!${content}`);
      } else {
        ctx.ui.setEditorText(content);
      }
    },
  });
}
