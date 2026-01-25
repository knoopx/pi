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

type HistoryEntry = {
  content: string;
  timestamp: number;
  type: "command" | "message";
};

// Simple fuzzy matching - returns true if all chars in query appear in text in order
const fuzzyMatch = (text: string, query: string): boolean => {
  if (!query) return true;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  let textIdx = 0;

  for (const char of queryLower) {
    textIdx = textLower.indexOf(char, textIdx);
    if (textIdx === -1) return false;
    textIdx++;
  }

  return true;
};

// Load history (commands and messages) from session files matching the given cwd
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
              if (sessionCwd !== targetCwd) return;

              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const entry = JSON.parse(line);

                  if (entry.type !== "message" || !entry.message) continue;

                  let timestamp: number;
                  if (typeof entry.timestamp === "string") {
                    timestamp = new Date(entry.timestamp).getTime();
                  } else if (typeof entry.timestamp === "number") {
                    timestamp = entry.timestamp;
                  } else if (
                    entry.message.timestamp &&
                    typeof entry.message.timestamp === "number"
                  ) {
                    timestamp = entry.message.timestamp;
                  } else {
                    timestamp = Date.now();
                  }

                  // Look for user bash commands (! and !!)
                  if (
                    entry.message.role === "userBashCommand" &&
                    entry.message.command
                  ) {
                    const command = entry.message.command;
                    if (typeof command === "string" && !seen.has(command)) {
                      const trimmedCommand = command.trim();
                      if (trimmedCommand) {
                        seen.add(trimmedCommand);
                        history.push({
                          content: trimmedCommand,
                          timestamp,
                          type: "command",
                        });
                      }
                    }
                  }

                  // Look for user messages
                  if (
                    entry.message.role === "user" &&
                    Array.isArray(entry.message.content)
                  ) {
                    // Extract text from content blocks
                    const textParts: string[] = [];
                    for (const block of entry.message.content) {
                      if (
                        block.type === "text" &&
                        typeof block.text === "string"
                      ) {
                        textParts.push(block.text);
                      }
                    }

                    const message = textParts.join("\n").trim();
                    if (message && !seen.has(message)) {
                      seen.add(message);
                      history.push({
                        content: message,
                        timestamp,
                        type: "message",
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
        this.onSelect?.(this.filteredHistory[this.selectedIndex]!);
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

    // Title with search query
    const title = this.query
      ? `Reverse History Search: ${this.query}`
      : "Reverse History Search (type to filter)";
    container.addChild(
      new Text(this.theme.fg("accent", this.theme.bold(title)), 1, 0),
    );

    // Results count
    const countText =
      this.filteredHistory.length === 0
        ? this.theme.fg("warning", "No matching items")
        : this.theme.fg(
            "dim",
            `${this.filteredHistory.length} item${this.filteredHistory.length === 1 ? "" : "s"}`,
          );
    container.addChild(new Text(countText, 1, 0));

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
      const entry = this.filteredHistory[i]!;
      const isSelected = i === this.selectedIndex;

      // Type indicator
      const typeIndicator = entry.type === "command" ? "$" : "💬";
      const typeColor = entry.type === "command" ? "success" : "accent";

      let line = isSelected ? this.theme.fg("accent", "► ") : "  ";

      line += this.theme.fg(typeColor, typeIndicator + " ");

      // Truncate long content for display (show first line only)
      const displayContent = entry.content.split("\n")[0] || "";
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
          "$ = command | 💬 = message • ↑↓ navigate • enter select • esc cancel",
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

          component.onSelect = (entry) => done(entry);
          component.onCancel = () => done(null);

          return {
            render: (w) => component.render(w),
            invalidate: () => component.invalidate(),
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
