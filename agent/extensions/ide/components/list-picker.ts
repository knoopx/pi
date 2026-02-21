import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
import { truncateAnsi, ensureWidth, pad, buildHelpText } from "./text-utils";
import {
  calculateDimensions,
  renderSplitPanel,
  renderSourceRows,
} from "./split-panel";
import {
  isRenderCacheValid,
  createBaseDimensionsConfig,
  createStatusNotifier,
  formatHelpWithStatus,
  type StatusMessageState,
} from "./shared-utils";

export interface ListPickerItem {
  id: string;
  label: string;
  path?: string;
  startLine?: number;
  endLine?: number;
}

export interface ListPickerAction<T extends ListPickerItem> {
  key: string;
  label: string;
  handler: (item: T) => Promise<void> | void;
}

export interface ListPickerConfig<T extends ListPickerItem> {
  title: string | (() => string);
  /** Load items, optionally filtered by query */
  loadItems: (query: string) => Promise<T[]>;
  /** Local filtering (used when query changes between loads) */
  filterItems: (items: T[], query: string) => T[];
  formatItem: (
    item: T,
    width: number,
    theme: Theme,
    isFocused: boolean,
  ) => string;
  loadPreview: (item: T) => Promise<string[]>;
  onEdit?: (item: T) => Promise<void> | void;
  helpParts?: string[];
  actions?: ListPickerAction<T>[];
  /** Debounce delay for reloading on query change (0 = no reload, default) */
  reloadDebounceMs?: number;
  /** Custom key handler, return true if handled */
  onKey?: (key: string) => boolean;
}

export interface ListPickerTui {
  terminal: { rows: number };
  requestRender: () => void;
}

export interface ListPickerComponent {
  render: (width: number) => string[];
  handleInput: (data: string) => void;
  dispose: () => void;
  setPreview: (lines: string[]) => void;
  invalidate: () => void;
  reload: () => Promise<void>;
  notify?: (message: string, type?: "info" | "error") => void;
  getSearchQuery?: () => string;
  clearSearchQuery?: () => void;
}

export function createListPicker<T extends ListPickerItem>(
  _pi: ExtensionAPI,
  tui: ListPickerTui,
  theme: Theme,
  _keybindings: KeybindingsManager,
  done: (result: T | null) => void,
  initialQuery: string,
  config: ListPickerConfig<T>,
): ListPickerComponent {
  let items: T[] = [];
  let filteredItems: T[] = [];
  let focusedIndex = 0;
  let searchQuery = initialQuery;
  let lastLoadedQuery = "";
  let sourceLines: string[] = [];
  let sourceScroll = 0;
  let loading = true;
  let error: string | null = null;
  let cachedLines: string[] = [];
  let cachedWidth = 0;
  const previewCache = new Map<string, string[]>();
  const statusState: StatusMessageState = { message: null, timeout: null };
  let reloadTimeout: ReturnType<typeof setTimeout> | null = null;

  const showStatus = createStatusNotifier(statusState, () => {
    invalidate();
    tui.requestRender();
  });

  async function loadItemsWithQuery(query: string): Promise<void> {
    try {
      lastLoadedQuery = query;
      items = await config.loadItems(query);
      filterItems();
      loading = false;

      if (filteredItems.length > 0) {
        void loadPreview(filteredItems[0]);
      }

      invalidate();
      tui.requestRender();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      loading = false;
      invalidate();
      tui.requestRender();
    }
  }

  function scheduleReload(query: string): void {
    if (!config.reloadDebounceMs) return;
    if (reloadTimeout) clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
      void loadItemsWithQuery(query);
    }, config.reloadDebounceMs);
  }

  function filterItems(): void {
    if (!searchQuery) {
      filteredItems = items;
    } else {
      const lower = searchQuery.toLowerCase();
      filteredItems = config.filterItems(items, lower);
    }
    focusedIndex = Math.min(
      focusedIndex,
      Math.max(0, filteredItems.length - 1),
    );
  }

  function getFocusedItem(): T | null {
    if (filteredItems.length === 0) {
      return null;
    }

    return filteredItems[focusedIndex];
  }

  async function loadPreview(item: T): Promise<void> {
    const cacheKey = item.path ?? item.id;
    const cached = previewCache.get(cacheKey);
    if (cached) {
      sourceLines = cached;
      sourceScroll = item.startLine ? Math.max(0, item.startLine - 3) : 0;
      invalidate();
      tui.requestRender();
      return;
    }

    try {
      const lines = await config.loadPreview(item);
      previewCache.set(cacheKey, lines);
      sourceLines = lines;
      sourceScroll = item.startLine ? Math.max(0, item.startLine - 3) : 0;
      invalidate();
      tui.requestRender();
    } catch {
      sourceLines = [];
      invalidate();
      tui.requestRender();
    }
  }

  function invalidate(): void {
    cachedLines = [];
    cachedWidth = 0;
  }

  function getItemRows(width: number, height: number): string[] {
    const rows: string[] = [];

    if (loading) {
      rows.push(theme.fg("dim", pad(" Loading...", width)));
      return rows;
    }

    if (error) {
      rows.push(theme.fg("error", pad(` Error: ${error}`, width)));
      return rows;
    }

    if (filteredItems.length === 0) {
      rows.push(theme.fg("dim", pad(" No items found", width)));
      return rows;
    }

    let startIdx = 0;
    if (focusedIndex >= height) {
      startIdx = focusedIndex - height + 1;
    }

    for (let i = 0; i < height && startIdx + i < filteredItems.length; i++) {
      const idx = startIdx + i;
      const item = filteredItems[idx];
      const isFocused = idx === focusedIndex;
      const formatted = config.formatItem(item, width - 2, theme, isFocused);
      const text = " " + truncateAnsi(formatted, width - 2);
      const padded = ensureWidth(text, width);
      rows.push(padded);
    }

    return rows;
  }

  function render(width: number): string[] {
    if (isRenderCacheValid(width, cachedWidth, cachedLines)) {
      return cachedLines;
    }

    const dims = calculateDimensions(
      tui.terminal.rows,
      width,
      createBaseDimensionsConfig(true),
    );

    const titleText =
      typeof config.title === "function" ? config.title() : config.title;
    const searchDisplay = searchQuery
      ? ` Search: ${truncateAnsi(searchQuery, dims.leftW - 10)}`
      : ` ${titleText}`;
    const itemCount = `(${String(filteredItems.length)}/${String(items.length)})`;
    const leftTitle = truncateAnsi(`${searchDisplay} ${itemCount}`, dims.leftW);

    const focusedItem = getFocusedItem();
    const rightTitle = focusedItem?.path
      ? ` ${truncateAnsi(focusedItem.path, dims.rightW - 2)}`
      : " Source Preview";

    const itemRows = getItemRows(dims.leftW, dims.contentH);
    const sourceRows = renderSourceRows(
      sourceLines,
      dims.rightW,
      dims.contentH,
      sourceScroll,
      theme,
      focusedItem?.startLine && focusedItem.endLine
        ? { start: focusedItem.startLine, end: focusedItem.endLine }
        : undefined,
    );

    const baseParts = config.helpParts ?? ["↑↓ nav", "type to search"];
    const actionHelp = (config.actions ?? []).map((a) => `${a.key} ${a.label}`);
    const helpText = formatHelpWithStatus(
      theme,
      statusState.message,
      buildHelpText(
        ...baseParts,
        filteredItems.length > 0 && "enter select",
        filteredItems.length > 0 && config.onEdit && "ctrl+e edit",
        ...(filteredItems.length > 0 ? actionHelp : []),
        "esc",
      ),
    );

    cachedLines = renderSplitPanel(
      theme,
      {
        leftTitle,
        rightTitle,
        helpText,
        leftFocus: true,
      },
      dims,
      {
        left: itemRows,
        right: sourceRows,
      },
    );

    cachedWidth = width;
    return cachedLines;
  }

  function handleInput(data: string): void {
    if (matchesKey(data, "escape")) {
      done(null);
      return;
    }

    // Custom key handler
    if (config.onKey?.(data)) {
      return;
    }

    if (matchesKey(data, "enter")) {
      done(getFocusedItem());
      return;
    }

    if (matchesKey(data, "ctrl+e") && config.onEdit) {
      const item = getFocusedItem();
      if (item !== null) {
        void Promise.resolve(config.onEdit(item));
      }
      return;
    }

    if (matchesKey(data, "up")) {
      if (focusedIndex > 0) {
        focusedIndex--;
        const item = getFocusedItem();
        if (item !== null) {
          void loadPreview(item);
        }
        invalidate();
        tui.requestRender();
      }
      return;
    }

    if (matchesKey(data, "down")) {
      if (focusedIndex < filteredItems.length - 1) {
        focusedIndex++;
        const item = getFocusedItem();
        if (item !== null) {
          void loadPreview(item);
        }
        invalidate();
        tui.requestRender();
      }
      return;
    }

    if (matchesKey(data, "pageUp")) {
      const dims = calculateDimensions(tui.terminal.rows, 100, {
        leftTitle: "",
        rightTitle: "",
        helpText: "",
        leftFocus: true,
      });
      focusedIndex = Math.max(0, focusedIndex - dims.contentH);
      const item = getFocusedItem();
      if (item !== null) {
        void loadPreview(item);
      }
      invalidate();
      tui.requestRender();
      return;
    }

    if (matchesKey(data, "pageDown")) {
      const dims = calculateDimensions(tui.terminal.rows, 100, {
        leftTitle: "",
        rightTitle: "",
        helpText: "",
        leftFocus: true,
      });
      focusedIndex = Math.min(
        filteredItems.length - 1,
        focusedIndex + dims.contentH,
      );
      const item = getFocusedItem();
      if (item !== null) {
        void loadPreview(item);
      }
      invalidate();
      tui.requestRender();
      return;
    }

    // Backspace - delete from search query
    if (data === "\x7f" || data === "\b") {
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        filterItems();
        scheduleReload(searchQuery);
        const item = getFocusedItem();
        if (item !== null) {
          void loadPreview(item);
        }
        invalidate();
        tui.requestRender();
      }
      return;
    }

    // Check custom actions first (before printable characters)
    if (config.actions && filteredItems.length > 0) {
      const action = config.actions.find((a) =>
        matchesKey(data, a.key as Parameters<typeof matchesKey>[1]),
      );
      if (action) {
        const item = getFocusedItem();
        if (item !== null) {
          void Promise.resolve(action.handler(item));
        }
        return;
      }
    }

    // Printable characters - add to search query
    if (data.length === 1 && data >= " " && data <= "~") {
      searchQuery += data;
      filterItems();
      scheduleReload(searchQuery);
      const item = getFocusedItem();
      if (item !== null) {
        void loadPreview(item);
      }
      invalidate();
      tui.requestRender();
      return;
    }
  }

  function dispose(): void {
    previewCache.clear();
  }

  function setPreview(lines: string[]): void {
    sourceLines = lines;
    sourceScroll = 0;
    invalidate();
    tui.requestRender();
  }

  void loadItemsWithQuery(initialQuery);

  async function reload(): Promise<void> {
    loading = true;
    error = null;
    invalidate();
    tui.requestRender();
    await loadItemsWithQuery(searchQuery);
  }

  return {
    render,
    handleInput,
    dispose,
    setPreview,
    invalidate,
    reload,
    notify: showStatus,
    getSearchQuery: () => searchQuery,
    clearSearchQuery: () => {
      searchQuery = "";
      filterItems();
      invalidate();
      tui.requestRender();
    },
  };
}
