import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";
import { pad, buildHelpText, ensureWidth, truncateAnsi } from "./utils";
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
