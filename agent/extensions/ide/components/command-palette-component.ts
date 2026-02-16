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
import { truncateAnsi, ensureWidth, buildHelpText } from "./utils";

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

/** Box drawing characters */
const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeLeft: "├",
  teeRight: "┤",
};

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
    innerWidth: number,
  ): string {
    const icon = getCategoryIcon(cmd.category);
    const keybindingText = cmd.keybinding ? ` [${cmd.keybinding}]` : "";
    const keybindingLen = cmd.keybinding ? keybindingText.length : 0;

    // Calculate available space
    const iconLen = 2; // icon + space
    const nameLen = cmd.name.length;
    const separatorLen = cmd.description ? 3 : 0; // " · "
    const fixedLen = iconLen + nameLen + separatorLen + keybindingLen + 2; // padding
    const descMaxLen = Math.max(0, innerWidth - fixedLen);

    const desc =
      cmd.description.length > descMaxLen
        ? cmd.description.slice(0, descMaxLen - 1) + "…"
        : cmd.description;

    // Build the row content
    const nameText = isFocused
      ? theme.fg("accent", theme.bold(cmd.name))
      : cmd.name;
    const descText = desc ? theme.fg("dim", ` · ${desc}`) : "";
    const keyText = cmd.keybinding
      ? theme.fg("dim", ` [${cmd.keybinding}]`)
      : "";

    const content = ` ${icon} ${nameText}${descText}${keyText}`;
    const truncated = truncateAnsi(content, innerWidth);

    if (isFocused) {
      return theme.bg("selectedBg", ensureWidth(truncated, innerWidth));
    }
    return ensureWidth(truncated, innerWidth);
  }

  /** Create a bordered line */
  function borderedLine(
    content: string,
    innerWidth: number,
    leftChar: string = BOX.vertical,
    rightChar: string = BOX.vertical,
  ): string {
    const inner = ensureWidth(content, innerWidth);
    return `${theme.fg("dim", leftChar)}${inner}${theme.fg("dim", rightChar)}`;
  }

  /** Main render function */
  function render(width: number): string[] {
    if (cachedWidth === width && cachedLines.length > 0) {
      return cachedLines;
    }

    const lines: string[] = [];
    const maxHeight = Math.min(tui.terminal.rows - 4, 24);
    const innerWidth = width - 2; // account for borders
    const contentHeight = maxHeight - 6; // title + search + separator + help + borders

    // Top border with title
    const title = " Command Palette ";
    const titleLen = title.length;
    const leftPad = Math.floor((innerWidth - titleLen) / 2);
    const rightPad = innerWidth - titleLen - leftPad;
    const topBorder =
      theme.fg("dim", BOX.topLeft + BOX.horizontal.repeat(leftPad)) +
      theme.fg("accent", theme.bold(title)) +
      theme.fg("dim", BOX.horizontal.repeat(rightPad) + BOX.topRight);
    lines.push(topBorder);

    // Search input row
    const searchIcon = "󰍉";
    const searchPlaceholder = theme.fg("dim", "Type to filter commands...");
    const searchDisplay = searchQuery || searchPlaceholder;
    const cursor = searchQuery ? theme.fg("accent", "▏") : "";
    const searchContent = ` ${searchIcon}  ${searchDisplay}${cursor}`;
    lines.push(borderedLine(searchContent, innerWidth));

    // Separator
    const separator =
      theme.fg("dim", BOX.teeLeft) +
      theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
      theme.fg("dim", BOX.teeRight);
    lines.push(separator);

    // Commands list with scroll
    if (filteredCommands.length === 0) {
      const emptyMsg = theme.fg("dim", " No matching commands");
      lines.push(borderedLine(emptyMsg, innerWidth));
      for (let i = 1; i < contentHeight; i++) {
        lines.push(borderedLine("", innerWidth));
      }
    } else {
      // Calculate visible range
      let startIdx = 0;
      if (selectedIndex >= contentHeight) {
        startIdx = selectedIndex - contentHeight + 1;
      }

      const visibleCount = Math.min(
        contentHeight,
        filteredCommands.length - startIdx,
      );

      for (let i = 0; i < visibleCount; i++) {
        const idx = startIdx + i;
        const cmd = filteredCommands[idx];
        const isFocused = idx === selectedIndex;
        const rowContent = renderCommandRow(cmd, isFocused, innerWidth);
        lines.push(
          borderedLine(rowContent, innerWidth, BOX.vertical, BOX.vertical),
        );
      }

      // Fill remaining space
      for (let i = visibleCount; i < contentHeight; i++) {
        lines.push(borderedLine("", innerWidth));
      }
    }

    // Scroll indicator
    const totalCount = filteredCommands.length;
    const countText =
      totalCount > 0
        ? theme.fg("dim", ` ${selectedIndex + 1}/${totalCount}`)
        : "";
    const scrollContent = ensureWidth(countText, innerWidth);
    lines.push(borderedLine(scrollContent, innerWidth));

    // Help line with bottom border
    const helpText = buildHelpText("↑↓ navigate", "enter select", "esc close");
    const helpContent = ` ${theme.fg("dim", helpText)}`;

    // Bottom border
    const bottomSeparator =
      theme.fg("dim", BOX.teeLeft) +
      theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
      theme.fg("dim", BOX.teeRight);
    lines.push(bottomSeparator);

    lines.push(borderedLine(helpContent, innerWidth));

    const bottomBorder =
      theme.fg("dim", BOX.bottomLeft) +
      theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
      theme.fg("dim", BOX.bottomRight);
    lines.push(bottomBorder);

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

    if (matchesKey(data, "pageUp")) {
      selectedIndex = Math.max(0, selectedIndex - 10);
      invalidate();
      tui.requestRender();
      return;
    }

    if (matchesKey(data, "pageDown")) {
      selectedIndex = Math.min(filteredCommands.length - 1, selectedIndex + 10);
      invalidate();
      tui.requestRender();
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
