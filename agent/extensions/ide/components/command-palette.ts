/**
 * Command Palette Component
 *
 * Global command palette (Ctrl+Shift+P) that lists commands:
 * - Commands from `~/.pi/agent/commands/*.md` (shell-aware prompt templates)
 */

import type {
  ExtensionAPI,
  KeybindingsManager,
  AppAction,
  Theme,
} from "@mariozechner/pi-coding-agent";
import type { KeyId } from "@mariozechner/pi-tui";
import { truncateAnsi, ensureWidth, buildHelpText } from "./text-utils";
import { createKeyboardHandler } from "../keyboard";
import {
  borderedLine,
  topBorderWithTitle,
  horizontalSeparator,
  bottomBorder,
} from "./shared-utils";
import type {
  PaletteCommand,
  CommandPaletteTui,
  CommandPaletteComponent,
} from "./command-palette-types";
import { loadFileCommands, evaluateShellCommands } from "./command-file-loader";
import { createArgFormComponent } from "./command-arg-form";

export function createCommandPaletteComponent(
  pi: ExtensionAPI,
  tui: CommandPaletteTui,
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: () => void,
  onExecuteCommand: (command: string) => void,
  _onExecuteAction: (action: AppAction) => void,
  _registeredShortcuts: {
    shortcut: KeyId;
    description?: string;
    execute: () => void;
  }[],
  ctx?: {
    hasUI: boolean;
    ui: { custom: unknown; setEditorText: unknown; notify: unknown };
  },
): CommandPaletteComponent {
  // State
  let commands: PaletteCommand[] = [];
  let filteredCommands: PaletteCommand[] = [];
  let selectedIndex = 0;
  let searchQuery = "";
  let cachedLines: string[] = [];
  let cachedWidth = 0;
  let isExecuting = false;

  function invalidate(): void {
    cachedLines = [];
    cachedWidth = 0;
  }

  /** Build list of all available commands */
  function loadCommands(): void {
    commands = [];

    // Add file commands (shell-aware prompt templates)
    const fileCommands = loadFileCommands(pi);
    for (const cmd of fileCommands) {
      const hasArgs = cmd.args && Object.keys(cmd.args).length > 0;
      commands.push({
        id: `filecmd:${cmd.name}`,
        name: cmd.name,
        description: cmd.description,
        action: () => {
          // Fire and forget: async execution without blocking
          void (async () => {
            if (isExecuting) return;
            isExecuting = true;
            tui.requestRender();

            try {
              // If command has args, show form to fill them
              if (hasArgs && cmd.args && ctx && ctx.hasUI && ctx.ui) {
                // Close the palette first, then show form
                done();
                // Show the arg form component
                (ctx.ui.custom as (factory: unknown, opts: unknown) => void)(
                  (
                    formTui: CommandPaletteTui,
                    formTheme: Theme,
                    _keybindings: unknown,
                    formDone: () => void,
                  ) => {
                    return createArgFormComponent(
                      pi,
                      cmd.args!,
                      (result) => {
                        formDone(); // Close overlay first
                        if (Object.keys(result).length > 0) {
                          // Fill template with named arguments ($from, $to, etc.)
                          let expandedTemplate = cmd.template;
                          for (const [key, value] of Object.entries(result)) {
                            expandedTemplate = expandedTemplate.replace(
                              new RegExp(`\\$${key}`, "g"),
                              value,
                            );
                          }

                          // Evaluate shell commands if present
                          if (cmd.hasShellCommands) {
                            const cwd = process.cwd();
                            void evaluateShellCommands(
                              pi,
                              expandedTemplate,
                              cwd,
                            ).then((evaluated) => {
                              onExecuteCommand(evaluated);
                            });
                          } else {
                            onExecuteCommand(expandedTemplate);
                          }
                        }
                      },
                      formTui,
                      formTheme,
                    );
                  },
                  {
                    overlay: true,
                    overlayOptions: {
                      width: "50%",
                      anchor: "center",
                    },
                  },
                );
              } else {
                // Execute template directly
                let expandedTemplate = cmd.template;

                if (cmd.hasShellCommands) {
                  const cwd = process.cwd();
                  expandedTemplate = await evaluateShellCommands(
                    pi,
                    cmd.template,
                    cwd,
                  );
                }

                onExecuteCommand(expandedTemplate);
              }
            } catch (error) {
              console.error("Failed to execute command:", error);
            } finally {
              isExecuting = false;
            }
          })();
        },
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

    // Sort alphabetically by name
    filteredCommands.sort((a, b) => a.name.localeCompare(b.name));

    selectedIndex = Math.min(selectedIndex, filteredCommands.length - 1);
    if (selectedIndex < 0) selectedIndex = 0;
    invalidate();
  }

  /** Render a single command row */
  function renderCommandRow(
    cmd: PaletteCommand,
    isFocused: boolean,
    innerWidth: number,
  ): string {
    const icon = "󰘳";

    // Calculate available space
    const iconLen = 2; // icon + space
    const nameLen = cmd.name.length;
    const separatorLen = cmd.description ? 3 : 0; // " · "
    const fixedLen = iconLen + nameLen + separatorLen + 2; // padding
    const descMaxLen = Math.max(0, innerWidth - fixedLen);

    const desc =
      cmd.description.length > descMaxLen
        ? cmd.description.slice(0, descMaxLen - 1) + "…"
        : cmd.description;

    // Build row content
    const nameText = isFocused
      ? theme.fg("accent", theme.bold(cmd.name))
      : cmd.name;
    const descText = desc ? theme.fg("dim", ` · ${desc}`) : "";

    const content = ` ${icon} ${nameText}${descText}`;
    const truncated = truncateAnsi(content, innerWidth);

    if (isFocused) {
      return theme.bg("selectedBg", ensureWidth(truncated, innerWidth));
    }
    return ensureWidth(truncated, innerWidth);
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
    lines.push(topBorderWithTitle(theme, " Command Palette ", innerWidth));

    // Search input row
    const searchIcon = "󰍉";
    const searchPlaceholder = isExecuting
      ? theme.fg("warning", "Executing command...")
      : theme.fg("dim", "Type to filter commands...");
    const searchDisplay = searchQuery || searchPlaceholder;
    const cursor = searchQuery ? theme.fg("accent", "▏") : "";
    const searchContent = ` ${searchIcon}  ${searchDisplay}${cursor}`;
    lines.push(borderedLine(theme, searchContent, innerWidth));

    // Separator
    lines.push(horizontalSeparator(theme, innerWidth));

    // Commands list with scroll
    if (filteredCommands.length === 0) {
      const emptyMsg = theme.fg("dim", " No matching commands");
      lines.push(borderedLine(theme, emptyMsg, innerWidth));
      for (let i = 1; i < contentHeight; i++) {
        lines.push(borderedLine(theme, "", innerWidth));
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
        lines.push(borderedLine(theme, rowContent, innerWidth));
      }

      // Fill remaining space
      for (let i = visibleCount; i < contentHeight; i++) {
        lines.push(borderedLine(theme, "", innerWidth));
      }
    }

    // Scroll indicator
    const totalCount = filteredCommands.length;
    const countText =
      totalCount > 0
        ? theme.fg("dim", ` ${selectedIndex + 1}/${totalCount}`)
        : "";
    const scrollContent = ensureWidth(countText, innerWidth);
    lines.push(borderedLine(theme, scrollContent, innerWidth));

    // Help line with bottom border
    const helpText = buildHelpText("↑↓ navigate", "enter select", "esc close");
    const helpContent = ` ${theme.fg("dim", helpText)}`;

    lines.push(horizontalSeparator(theme, innerWidth));
    lines.push(borderedLine(theme, helpContent, innerWidth));
    lines.push(bottomBorder(theme, innerWidth));

    cachedLines = lines;
    cachedWidth = width;
    return cachedLines;
  }

  /** Handle keyboard input */
  const handleKeyboard = createKeyboardHandler({
    bindings: [
      {
        key: "ctrl+u",
        handler: () => {
          searchQuery = "";
          filterCommands();
          tui.requestRender();
        },
      },
    ],
    navigation: () => ({
      index: selectedIndex,
      maxIndex: filteredCommands.length - 1,
      pageSize: 10,
    }),
    onNavigate: (newIndex) => {
      selectedIndex = newIndex;
      invalidate();
      tui.requestRender();
    },
    onEscape: () => done(),
    onEnter: () => {
      const cmd = filteredCommands[selectedIndex];
      if (cmd) {
        done();
        cmd.action();
      }
    },
    onBackspace: () => {
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        filterCommands();
        tui.requestRender();
      }
    },
    onTextInput: (char) => {
      searchQuery += char;
      filterCommands();
      tui.requestRender();
    },
  });

  function handleInput(data: string): void {
    if (isExecuting) {
      return;
    }
    handleKeyboard(data);
  }

  function dispose(): void {
    // No cleanup needed
  }

  // Initialize commands
  loadCommands();

  return {
    render,
    handleInput,
    invalidate,
    dispose,
  };
}
