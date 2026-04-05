import type {
  ExtensionAPI,
  KeybindingsManager,
  Theme,
} from "@mariozechner/pi-coding-agent";

/** Common TUI interface for components */
interface ComponentTui {
  terminal: { rows: number };
  requestRender: () => void;
}

/** Base component parameters shared across overlay components */
export interface BaseComponentParams {
  pi: ExtensionAPI;
  tui: ComponentTui;
  theme: Theme;
  keybindings: KeybindingsManager;
  cwd: string;
}

/** Generic cache interface for component state */
export interface ComponentCache<T = unknown> {
  files: T[];
  diffs: Map<string, string[]>;
}

/** Creates a standardized cache instance */
export function createComponentCache<T = unknown>(
  files: T[] = [],
): ComponentCache<T> {
  return {
    files,
    diffs: new Map(),
  };
}

/** Creates standardized selection state */
export function createSelectionState(): {
  selectedIndex: number;
  fileIndex: number;
  diffScroll: number;
  focus: "left" | "right";
} {
  return {
    selectedIndex: 0,
    fileIndex: 0,
    diffScroll: 0,
    focus: "left",
  };
}

/** Creates standardized loading state */
export function createLoadingState(): {
  loading: boolean;
  cachedLines: string[];
  cachedWidth: number;
} {
  return {
    loading: true,
    cachedLines: [],
    cachedWidth: 0,
  };
}

/** Generic cache invalidation */
export function invalidateCache(state: {
  loading: boolean;
  cachedLines: string[];
  cachedWidth: number;
}): void {
  state.cachedLines = [];
  state.cachedWidth = 0;
}

/** Check if render cache is valid */
export function isRenderCacheValid(
  width: number,
  cachedWidth: number,
  cachedLines: string[],
): boolean {
  return cachedWidth === width && cachedLines.length > 0;
}
