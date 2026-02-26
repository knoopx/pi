import { fuzzyMatch } from "../../shared/fuzzy";

/**
 * Reverse History Search - Ctrl+R fuzzy history search
 *
 * Usage: pi (extension auto-loaded from .pi/extensions/)
 *
 * - Ctrl+R: Open reverse history search
 * - Type to fuzzy filter commands
 * - Up/Down: Navigate results
 * - Enter: Insert selected command into editor
 * - Escape: Cancel
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import { Container, matchesKey, Text, type TUI } from "@mariozechner/pi-tui";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface HistoryEntry {
  content: string;
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
  if (typeof message !== "object" || message === null) {
    return null;
  }

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
  history.push({ ...entry, content });
};

const extractBangCommandsFromUserText = (text: string): string[] => {
  const commands: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("!")) continue;

    const command = line.replace(/^!+/, "").trim();
    if (command) {
      commands.push(command);
    }
  }

  return commands;
};

const getUserTextFromContent = (content: unknown): string => {
  if (!Array.isArray(content)) {
    return "";
  }

  const parts = content
    .map((block) => {
      if (typeof block !== "object" || block === null) {
        return "";
      }

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

const extractBashToolCommands = (content: unknown): string[] => {
  if (!Array.isArray(content)) return [];

  const commands: string[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;

    const typedBlock = block as {
      type?: unknown;
      name?: unknown;
      arguments?: unknown;
    };

    if (typedBlock.type !== "toolCall") continue;
    if (typedBlock.name !== "bash") continue;
    if (
      typeof typedBlock.arguments !== "object" ||
      typedBlock.arguments === null
    ) {
      continue;
    }

    const args = typedBlock.arguments as { command?: unknown };
    if (typeof args.command === "string" && args.command.trim()) {
      commands.push(args.command.trim());
    }
  }

  return commands;
};

const truncateSingleLine = (value: string, maxLength: number): string => {
  const oneLine = value.replace(/\s+/g, " ").trim();
  const safeMaxLength = Math.max(12, maxLength);
  if (oneLine.length <= safeMaxLength) return oneLine;
  return `${oneLine.slice(0, safeMaxLength - 1)}…`;
};

// Load command history from session files matching the given cwd
const loadSessionHistoryForCwd = (targetCwd: string): HistoryEntry[] => {
  const history: HistoryEntry[] = [];
  const seen = new Set<string>();

  try {
    const sessionsDir = join(homedir(), ".pi", "agent", "sessions");

    // Walk through all subdirectories
    const walkDir = (dir: string) => {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              walkDir(fullPath);
            } else if (entry.endsWith(".jsonl")) {
              // Parse session file
              const content = readFileSync(fullPath, "utf-8");
              const lines = content.trim().split("\n");

              // First, check if this session matches the target cwd
              let sessionCwd: string | null = null;
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.type === "session" && parsed.cwd) {
                    sessionCwd = parsed.cwd;
                    break;
                  }
                } catch {
                  // Skip invalid JSON lines
                }
              }

              // Skip sessions that don't match the target cwd
              if (!sessionCwd || !isPathMatch(sessionCwd, targetCwd)) continue;

              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const entry = JSON.parse(line) as SessionLine;
                  if (entry.type !== "message") continue;

                  const message = asSessionMessage(entry.message);
                  if (!message) continue;

                  let timestamp: number;
                  if (typeof entry.timestamp === "string") {
                    timestamp = new Date(entry.timestamp).getTime();
                  } else if (typeof entry.timestamp === "number") {
                    timestamp = entry.timestamp;
                  } else if (typeof message.timestamp === "number") {
                    timestamp = message.timestamp;
                  } else {
                    timestamp = Date.now();
                  }

                  if (
                    message.role === "userBashCommand" &&
                    typeof message.command === "string"
                  ) {
                    addHistoryEntry(history, seen, {
                      content: message.command,
                      timestamp,
                      type: "command",
                    });
                  }

                  if (message.role === "user") {
                    const text = getUserTextFromContent(message.content);
                    if (!text) continue;

                    const firstLine = text.split("\n")[0]?.trim();
                    if (firstLine) {
                      addHistoryEntry(history, seen, {
                        content: firstLine,
                        timestamp,
                        type: "message",
                      });
                    }

                    for (const command of extractBangCommandsFromUserText(
                      text,
                    )) {
                      addHistoryEntry(history, seen, {
                        content: command,
                        timestamp,
                        type: "command",
                      });
                    }
                  }

                  if (message.role === "assistant") {
                    for (const command of extractBashToolCommands(
                      message.content,
                    )) {
                      addHistoryEntry(history, seen, {
                        content: command,
                        timestamp,
                        type: "command",
                      });
                    }
                  }
                } catch {
                  // Skip invalid JSON lines
                }
              }
            }
          } catch {
            // Skip files we can't read
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    walkDir(sessionsDir);
  } catch {
    // Sessions directory doesn't exist or can't be read
  }

  // Sort by timestamp, most recent first
  return history.sort((a, b) => b.timestamp - a.timestamp);
};

class HistorySearchComponent {
  private allHistory: HistoryEntry[];
  private filteredHistory: HistoryEntry[];
  private query = "";
  private selectedIndex = 0;
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

  handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      this.onCancel?.();
      return;
    }

    if (matchesKey(data, "enter")) {
      if (this.filteredHistory.length > 0) {
        this.onSelect?.(this.filteredHistory[this.selectedIndex]);
      }
      return;
    }

    if (matchesKey(data, "up")) {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        this.invalidate();
      }
      return;
    }

    if (matchesKey(data, "down")) {
      if (this.selectedIndex < this.filteredHistory.length - 1) {
        this.selectedIndex++;
        this.invalidate();
      }
      return;
    }

    if (matchesKey(data, "backspace") || matchesKey(data, "delete")) {
      if (this.query.length > 0) {
        this.query = this.query.slice(0, -1);
        this.updateFilter();
      }
      return;
    }

    // Regular character input
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.query += data;
      this.updateFilter();
    }
  }

  private updateFilter(): void {
    this.filteredHistory = this.allHistory.filter((entry) =>
      fuzzyMatch(entry.content, this.query),
    );

    // Reset selection if out of bounds
    if (this.selectedIndex >= this.filteredHistory.length) {
      this.selectedIndex = Math.max(0, this.filteredHistory.length - 1);
    }

    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const container = new Container();
    const border = new DynamicBorder((s: string) => this.theme.fg("accent", s));

    // Top border
    container.addChild(border);

    // History list (show up to 10)
    const maxVisible = 10;
    const start = Math.max(
      0,
      Math.min(
        this.selectedIndex - 4,
        this.filteredHistory.length - maxVisible,
      ),
    );
    const end = Math.min(start + maxVisible, this.filteredHistory.length);

    for (let i = start; i < end; i++) {
      const entry = this.filteredHistory[i];
      const isSelected = i === this.selectedIndex;

      // Type indicator
      const typeIndicator = entry.type === "command" ? "$" : "󰆉";
      const typeColor = entry.type === "command" ? "success" : "accent";

      let line = isSelected ? this.theme.fg("accent", "► ") : "  ";

      line += this.theme.fg(typeColor, typeIndicator + " ");

      // Keep one visual row per entry
      const rowMaxWidth = Math.max(20, width - 8);
      const displayContent = truncateSingleLine(entry.content, rowMaxWidth);
      const contentText = isSelected
        ? this.theme.fg("accent", displayContent)
        : displayContent;

      line += contentText;

      container.addChild(new Text(line, 1, 0));
    }

    // Scroll indicator
    if (this.filteredHistory.length > maxVisible) {
      const scrollInfo = `[${start + 1}-${end} of ${this.filteredHistory.length}]`;
      container.addChild(new Text(this.theme.fg("dim", scrollInfo), 1, 0));
    }

    // Help text
    container.addChild(
      new Text(
        this.theme.fg(
          "dim",
          "$ = command | 󰆉 = message • ↑↓ navigate • enter select • esc cancel",
        ),
        1,
        0,
      ),
    );

    // Bottom border
    container.addChild(border);

    this.cachedLines = container.render(width);
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export default function (pi: ExtensionAPI) {
  pi.registerShortcut("ctrl+r", {
    description:
      "Reverse history search (user messages and commands from sessions in current directory)",
    handler: async (ctx: ExtensionContext) => {
      if (!ctx.hasUI) return;

      // Load history (messages and commands) from sessions matching current cwd
      const history = loadSessionHistoryForCwd(ctx.cwd);

      if (history.length === 0) {
        ctx.ui.notify("No history found", "warning");
        return;
      }

      const result = await ctx.ui.custom<HistoryEntry | null>(
        (
          tui: TUI,
          theme: Theme,
          _kb: KeybindingsManager,
          done: (result: HistoryEntry | null) => void,
        ) => {
          const component = new HistorySearchComponent(theme, history);

          component.onSelect = (entry) => {
            done(entry);
          };
          component.onCancel = () => {
            done(null);
          };

          return {
            render: (w) => component.render(w),
            invalidate: () => {
              component.invalidate();
            },
            handleInput: (data: string) => {
              component.handleInput(data);
              tui.requestRender();
            },
          };
        },
      );

      if (result) {
        // Insert selected content into editor
        if (result.type === "command") {
          ctx.ui.setEditorText("!" + result.content.trim().replace(/\n+$/, ""));
        } else {
          ctx.ui.setEditorText(result.content.trim().replace(/\n+$/, ""));
        }
      }
    },
  });
}
