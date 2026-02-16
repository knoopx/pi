/**
 * Command Palette Component
 *
 * Global command palette (Ctrl+Shift+P) that lists all available commands:
 * - Built-in slash commands
 * - Extension-registered commands
 * - App actions (interrupt, clear, exit, etc.)
 * - Extension shortcuts
 */

import type {
  ExtensionAPI,
  KeybindingsManager,
  AppAction,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { KeyId } from "@mariozechner/pi-tui";
import { matchesKey } from "@mariozechner/pi-tui";
import { truncateAnsi, ensureWidth, pad, buildHelpText } from "./utils";

/** Unified command type for display */
interface PaletteCommand {
  id: string;
  name: string;
  description: string;
  category: "command" | "action" | "shortcut";
  keybinding?: string;
  action: () => void;
}

interface CommandPaletteTui {
  terminal: { rows: number };
  requestRender: () => void;
}

interface CommandPaletteComponent {
  render: (width: number) => string[];
  handleInput: (data: string) => void;
  invalidate: () => void;
  dispose: () => void;
}

/** App actions with descriptions */
const APP_ACTION_DESCRIPTIONS: Partial<Record<AppAction, string>> = {
  interrupt: "Stop the current agent operation",
  clear: "Clear the conversation display",
  exit: "Exit pi",
  suspend: "Suspend pi (Ctrl+Z)",
  cycleThinkingLevel: "Cycle through thinking levels",
  cycleModelForward: "Switch to next model",
  cycleModelBackward: "Switch to previous model",
  selectModel: "Open model selector",
  expandTools: "Toggle tool output expansion",
  toggleThinking: "Toggle thinking display",
  toggleSessionNamedFilter: "Toggle session filter by name",
  externalEditor: "Open external editor",
  followUp: "Send follow-up message",
  dequeue: "Clear queued messages",
  pasteImage: "Paste image from clipboard",
  newSession: "Start a new session",
  tree: "Open session tree navigator",
  fork: "Fork current session",
};

/** Format a KeyId for display */
function formatKeybinding(keyId: KeyId): string {
  if (typeof keyId === "string") {
    return keyId
      .replace("ctrl+", "Ctrl+")
      .replace("alt+", "Alt+")
      .replace("shift+", "Shift+")
      .replace("escape", "Esc")
      .replace("enter", "Enter")
      .replace("tab", "Tab");
  }
  return String(keyId);
}

export function createCommandPaletteComponent(
  pi: ExtensionAPI,
  tui: CommandPaletteTui,
  theme: Theme,
  keybindings: KeybindingsManager,
  done: () => void,
  onExecuteCommand: (command: string) => void,
  onExecuteAction: (action: AppAction) => void,
  registeredShortcuts: {
    shortcut: KeyId;
    description?: string;
    execute: () => void;
  }[],
): CommandPaletteComponent {
  // State
  let commands: PaletteCommand[] = [];
  let filteredCommands: PaletteCommand[] = [];
  let selectedIndex = 0;
  let searchQuery = "";
  let cachedLines: string[] = [];
  let cachedWidth = 0;

  function invalidate(): void {
    cachedLines = [];
    cachedWidth = 0;
  }

  /** Build list of all available commands */
  function loadCommands(): void {
    commands = [];

    // Add slash commands
    const slashCommands = pi.getCommands();
    for (const cmd of slashCommands) {
      commands.push({
        id: `cmd:${cmd.name}`,
        name: `/${cmd.name}`,
        description: cmd.description || "",
        category: "command",
        action: () => {
          onExecuteCommand(`/${cmd.name}`);
        },
      });
    }

    // Add app actions with their keybindings
    const appActions: AppAction[] = [
      "interrupt",
      "clear",
      "exit",
      "suspend",
      "cycleThinkingLevel",
      "cycleModelForward",
      "cycleModelBackward",
      "selectModel",
      "expandTools",
      "toggleThinking",
      "toggleSessionNamedFilter",
      "externalEditor",
      "followUp",
      "dequeue",
      "pasteImage",
      "newSession",
      "tree",
      "fork",
    ];

    for (const action of appActions) {
      const keys = keybindings.getKeys(action);
      const keybinding =
        keys.length > 0 ? keys.map(formatKeybinding).join(", ") : undefined;

      commands.push({
        id: `action:${action}`,
        name: action,
        description: APP_ACTION_DESCRIPTIONS[action] || "",
        category: "action",
        keybinding,
        action: () => {
          onExecuteAction(action);
        },
      });
    }

    // Add registered extension shortcuts
    for (const shortcut of registeredShortcuts) {
      const keybinding = formatKeybinding(shortcut.shortcut);
      commands.push({
        id: `shortcut:${keybinding}`,
        name: shortcut.description || keybinding,
        description: `Shortcut: ${keybinding}`,
        category: "shortcut",
        keybinding,
        action: shortcut.execute,
      });
    }

    filterCommands();
  }

  /** Filter commands based on search query */
  function filterCommands(): void {
    if (!searchQuery) {
      filteredCommands = [...commands];
    } else {
      const query = searchQuery.toLowerCase();
      filteredCommands = commands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query),
      );
    }

    // Sort: commands first, then actions, then shortcuts
    filteredCommands.sort((a, b) => {
      const categoryOrder = { command: 0, action: 1, shortcut: 2 };
      const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
      if (catDiff !== 0) return catDiff;
      return a.name.localeCompare(b.name);
    });

    selectedIndex = Math.min(selectedIndex, filteredCommands.length - 1);
    if (selectedIndex < 0) selectedIndex = 0;
    invalidate();
  }

  /** Get category icon */
  function getCategoryIcon(category: PaletteCommand["category"]): string {
    switch (category) {
      case "command":
        return "󰘳"; // slash command
      case "action":
        return "󰌌"; // keyboard action
      case "shortcut":
        return "󰌑"; // shortcut key
    }
  }

  /** Render a single command row */
  function renderCommandRow(
    cmd: PaletteCommand,
    isFocused: boolean,
    width: number,
  ): string {
    const icon = getCategoryIcon(cmd.category);
    const keybindingText = cmd.keybinding
      ? theme.fg("dim", ` [${cmd.keybinding}]`)
      : "";

    // Calculate available space for name and description
    const nameText = isFocused
      ? theme.fg("accent", theme.bold(cmd.name))
      : cmd.name;
    const descText = cmd.description
      ? theme.fg("dim", ` - ${cmd.description}`)
      : "";

    const fullText = ` ${icon} ${nameText}${descText}${keybindingText}`;
    const truncated = truncateAnsi(fullText, width - 1);
    return ensureWidth(truncated, width);
  }

  /** Main render function */
  function render(width: number): string[] {
    if (cachedWidth === width && cachedLines.length > 0) {
      return cachedLines;
    }

    const lines: string[] = [];
    const maxHeight = Math.min(tui.terminal.rows - 4, 20);
    const contentHeight = maxHeight - 3; // title + search + help

    // Title bar
    const title = " 󰘳 Command Palette ";
    const titleLine = theme.fg("accent", theme.bold(title));
    lines.push(ensureWidth(titleLine, width));

    // Search input
    const searchPrefix = " > ";
    const searchText = searchQuery || theme.fg("dim", "Type to filter...");
    const searchLine = searchPrefix + searchText;
    lines.push(ensureWidth(searchLine, width));

    // Separator
    lines.push(theme.fg("dim", "─".repeat(width)));

    // Commands list with scroll
    if (filteredCommands.length === 0) {
      lines.push(ensureWidth(theme.fg("dim", " No commands found"), width));
    } else {
      // Calculate visible range
      let startIdx = 0;
      if (selectedIndex >= contentHeight) {
        startIdx = selectedIndex - contentHeight + 1;
      }

      for (
        let i = 0;
        i < contentHeight && startIdx + i < filteredCommands.length;
        i++
      ) {
        const idx = startIdx + i;
        const cmd = filteredCommands[idx];
        const isFocused = idx === selectedIndex;
        lines.push(renderCommandRow(cmd, isFocused, width));
      }
    }

    // Pad remaining space
    while (lines.length < maxHeight - 1) {
      lines.push(pad("", width));
    }

    // Help text
    const helpText = buildHelpText(
      "↑↓ nav",
      "enter select",
      "type filter",
      "esc close",
    );
    lines.push(ensureWidth(theme.fg("dim", ` ${helpText}`), width));

    cachedLines = lines;
    cachedWidth = width;
    return cachedLines;
  }

  /** Handle keyboard input */
  function handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      done();
      return;
    }

    if (matchesKey(data, "enter")) {
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        done();
        cmd.action();
      }
      return;
    }

    if (matchesKey(data, "up")) {
      if (selectedIndex > 0) {
        selectedIndex--;
        invalidate();
        tui.requestRender();
      }
      return;
    }

    if (matchesKey(data, "down")) {
      if (selectedIndex < filteredCommands.length - 1) {
        selectedIndex++;
        invalidate();
        tui.requestRender();
      }
      return;
    }

    // Backspace - delete from search query
    if (data === "\x7f" || data === "\b") {
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        filterCommands();
        tui.requestRender();
      }
      return;
    }

    // Ctrl+U - clear search
    if (data === "\x15") {
      searchQuery = "";
      filterCommands();
      tui.requestRender();
      return;
    }

    // Printable characters - add to search query
    if (data.length === 1 && data >= " " && data <= "~") {
      searchQuery += data;
      filterCommands();
      tui.requestRender();
      return;
    }
  }

  function dispose(): void {
    // No cleanup needed
  }

  // Initialize
  loadCommands();

  return {
    render,
    handleInput,
    invalidate,
    dispose,
  };
}
