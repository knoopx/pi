import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { pad, buildHelpText, ensureWidth, truncateAnsi } from "./utils";

/** Box drawing characters for bordered UI components */
export const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeLeft: "├",
  teeRight: "┤",
  teeDown: "┬",
  teeUp: "┴",
  cross: "┼",
} as const;

/** Create a bordered line with vertical bars on each side */
export function borderedLine(
  theme: Theme,
  content: string,
  innerWidth: number,
): string {
  const inner = ensureWidth(content, innerWidth);
  return `${theme.fg("dim", BOX.vertical)}${inner}${theme.fg("dim", BOX.vertical)}`;
}

/** Create a top border with centered title */
export function topBorderWithTitle(
  theme: Theme,
  title: string,
  innerWidth: number,
): string {
  const titleLen = title.length;
  const leftPad = Math.floor((innerWidth - titleLen) / 2);
  const rightPad = innerWidth - titleLen - leftPad;
  return (
    theme.fg("dim", BOX.topLeft + BOX.horizontal.repeat(leftPad)) +
    theme.fg("accent", theme.bold(title)) +
    theme.fg("dim", BOX.horizontal.repeat(rightPad) + BOX.topRight)
  );
}

/** Create a horizontal separator with tee connectors */
export function horizontalSeparator(theme: Theme, innerWidth: number): string {
  return (
    theme.fg("dim", BOX.teeLeft) +
    theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
    theme.fg("dim", BOX.teeRight)
  );
}

/** Create a bottom border */
export function bottomBorder(theme: Theme, innerWidth: number): string {
  return (
    theme.fg("dim", BOX.bottomLeft) +
    theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
    theme.fg("dim", BOX.bottomRight)
  );
}
import { calculateDiffScroll } from "./split-panel";
import type { SplitPanelConfig } from "./split-panel";

/**
 * Common TUI interface for components
 */
export interface ComponentTui {
  terminal: { rows: number };
  requestRender: () => void;
}

/**
 * Base component parameters shared across overlay components
 */
export interface BaseComponentParams {
  pi: ExtensionAPI;
  tui: ComponentTui;
  theme: Theme;
  keybindings: KeybindingsManager;
  cwd: string;
}

/**
 * Generic cache interface for component state
 */
export interface ComponentCache<T = unknown> {
  files: T[];
  diffs: Map<string, string[]>;
}

/**
 * Generic selection state for list-based components
 */
export interface SelectionState {
  selectedIndex: number;
  fileIndex: number;
  diffScroll: number;
  focus: "left" | "right";
}

/**
 * Generic loading state
 */
export interface LoadingState {
  loading: boolean;
  cachedLines: string[];
  cachedWidth: number;
}

/**
 * Creates a standardized cache instance
 */
export function createComponentCache<T = unknown>(
  files: T[] = [],
): ComponentCache<T> {
  return {
    files,
    diffs: new Map(),
  };
}

/**
 * Creates standardized selection state
 */
export function createSelectionState(): SelectionState {
  return {
    selectedIndex: 0,
    fileIndex: 0,
    diffScroll: 0,
    focus: "left",
  };
}

/**
 * Creates standardized loading state
 */
export function createLoadingState(): LoadingState {
  return {
    loading: true,
    cachedLines: [],
    cachedWidth: 0,
  };
}

/**
 * Generic navigation handler for list components
 */
export function createNavigationHandler<T>(
  items: T[],
  state: SelectionState,
  onSelectionChange: (item: T | null) => void,
  invalidate: () => void,
  requestRender: () => void,
) {
  return (direction: "up" | "down") => {
    const maxIndex = items.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, state.selectedIndex - 1)
        : Math.min(maxIndex, state.selectedIndex + 1);

    if (newIndex !== state.selectedIndex) {
      state.selectedIndex = newIndex;
      onSelectionChange(items[newIndex] || null);
      invalidate();
      requestRender();
    }
  };
}

/**
 * Generic file navigation handler
 */
export function createFileNavigationHandler<T extends { path?: string }>(
  files: T[],
  state: SelectionState,
  onFileChange: (file: T | null) => void,
  invalidate: () => void,
  requestRender: () => void,
) {
  return (direction: "up" | "down") => {
    const maxIndex = files.length - 1;
    const newIndex =
      direction === "up"
        ? Math.max(0, state.fileIndex - 1)
        : Math.min(maxIndex, state.fileIndex + 1);

    if (newIndex !== state.fileIndex) {
      state.fileIndex = newIndex;
      onFileChange(files[newIndex] || null);
      invalidate();
      requestRender();
    }
  };
}

/**
 * Generic diff scrolling handler
 */
export function createDiffScrollHandler(
  diffContent: string[],
  state: SelectionState,
  terminalRows: number,
  cachedWidth: number,
  invalidate: () => void,
  requestRender: () => void,
) {
  return (direction: "up" | "down") => {
    state.diffScroll = calculateDiffScroll(
      direction,
      state.diffScroll,
      diffContent.length,
      terminalRows,
      cachedWidth,
    );
    invalidate();
    requestRender();
  };
}

/**
 * Generic focus switching handler
 */
export function createFocusHandler(
  state: SelectionState,
  invalidate: () => void,
  requestRender: () => void,
) {
  return () => {
    state.focus = state.focus === "left" ? "right" : "left";
    invalidate();
    requestRender();
  };
}

/**
 * Generic cache invalidation
 */
export function invalidateCache(state: LoadingState): void {
  state.cachedLines = [];
  state.cachedWidth = 0;
}

/**
 * Generic error message formatter
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Generic loading row renderer
 */
export function renderLoadingRow(
  width: number,
  message = "Loading...",
): string {
  return pad(` ${message}`, width);
}

/**
 * Generic empty state renderer
 */
export function renderEmptyState(
  width: number,
  message: string,
  hint?: string,
): string[] {
  const rows = [pad(` ${message}`, width)];
  if (hint) {
    rows.push(pad(` ${hint}`, width));
  }
  return rows;
}

/**
 * Wrap rows in a single-panel border frame.
 */
export function renderFramedRows(
  theme: Theme,
  rows: string[],
  width: number,
  borderColor: "border" | "borderAccent" = "borderAccent",
): string[] {
  const innerWidth = Math.max(1, width - 2);

  const top =
    theme.fg(borderColor, "┌") +
    theme.fg(borderColor, "─".repeat(innerWidth)) +
    theme.fg(borderColor, "┐");

  const bottom =
    theme.fg(borderColor, "└") +
    theme.fg(borderColor, "─".repeat(innerWidth)) +
    theme.fg(borderColor, "┘");

  const content = rows.map(
    (row) =>
      theme.fg(borderColor, "│") +
      pad(row, innerWidth) +
      theme.fg(borderColor, "│"),
  );

  return [top, ...content, bottom];
}

/**
 * Generic row renderer with selection styling
 */
export function renderSelectableRow(
  text: string,
  width: number,
  isSelected: boolean,
  theme: {
    fg: (color: string, text: string) => string;
    bold: (text: string) => string;
  },
): string {
  const truncated = truncateAnsi(text, width);
  const padded = ensureWidth(truncated, width);
  return isSelected ? theme.fg("accent", theme.bold(padded)) : padded;
}

/**
 * Generic help text builder for navigation
 */
export function buildNavigationHelp(
  focus: "left" | "right",
  leftActions: string[] = [],
  rightActions: string[] = [],
): string {
  const baseHelp = ["tab ↑↓ nav"];

  if (focus === "left") {
    return buildHelpText(...baseHelp, ...leftActions);
  } else {
    return buildHelpText(...baseHelp, ...rightActions);
  }
}

/**
 * Check if render cache is valid
 */
export function isRenderCacheValid(
  width: number,
  cachedWidth: number,
  cachedLines: string[],
): boolean {
  return cachedWidth === width && cachedLines.length > 0;
}

/**
 * Base configuration for split panel dimensions calculation
 */
export function createBaseDimensionsConfig(
  leftFocus: boolean,
  rightFocus = false,
): SplitPanelConfig {
  return {
    leftTitle: "",
    rightTitle: "",
    helpText: "",
    leftFocus,
    rightFocus,
  };
}

/**
 * Status message state for notifications within overlays
 */
export interface StatusMessageState {
  message: { text: string; type: "info" | "error" } | null;
  timeout: ReturnType<typeof setTimeout> | null;
}

/**
 * Creates a status message handler for overlay components
 */
export function createStatusNotifier(
  state: StatusMessageState,
  onUpdate: () => void,
  duration = 3000,
): (message: string, type?: "info" | "error") => void {
  return (message: string, type: "info" | "error" = "info") => {
    if (state.timeout) clearTimeout(state.timeout);
    state.message = { text: message, type };
    onUpdate();
    state.timeout = setTimeout(() => {
      state.message = null;
      onUpdate();
    }, duration);
  };
}

/**
 * Format help text with optional status message override
 */
export function formatHelpWithStatus(
  theme: Theme,
  statusMessage: { text: string; type: "info" | "error" } | null,
  helpText: string,
): string {
  if (statusMessage) {
    return theme.fg(
      statusMessage.type === "error" ? "error" : "accent",
      statusMessage.text,
    );
  }
  return helpText;
}
