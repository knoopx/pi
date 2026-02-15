import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
import { truncateAnsi, ensureWidth, pad, buildHelpText } from "./utils";
import {
  calculateDimensions,
  renderSplitPanel,
  renderSourceRows,
} from "./split-panel";
import { isRenderCacheValid, createBaseDimensionsConfig } from "./shared-utils";

export interface ListPickerItem {
  id: string;
  label: string;
  path?: string;
  startLine?: number;
  endLine?: number;
}

export interface ListPickerConfig<T extends ListPickerItem> {
  title: string;
  loadItems: () => Promise<T[]>;
  filterItems: (items: T[], query: string) => T[];
  formatItem: (item: T, width: number) => string;
  loadPreview: (item: T) => Promise<string[]>;
  onEdit?: (item: T) => Promise<void> | void;
  helpParts?: string[];
}

export interface ListPickerTui {
  terminal: { rows: number };
  requestRender: () => void;
}

export interface ListPickerComponent {
  render: (width: number) => string[];
  handleInput: (data: string) => void;
  dispose: () => void;
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
  let selectedIndex = 0;
  let searchQuery = initialQuery;
  let sourceLines: string[] = [];
  let sourceScroll = 0;
  let loading = true;
  let error: string | null = null;
  let cachedLines: string[] = [];
  let cachedWidth = 0;
  const previewCache = new Map<string, string[]>();

  async function loadItems(): Promise<void> {
    try {
      items = await config.loadItems();
      filterItems();
      loading = false;

      if (filteredItems.length > 0) {
        void loadPreview(filteredItems[0]!);
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

  function filterItems(): void {
    if (!searchQuery) {
      filteredItems = items;
    } else {
      const lower = searchQuery.toLowerCase();
      filteredItems = config.filterItems(items, lower);
    }
    selectedIndex = Math.min(
      selectedIndex,
      Math.max(0, filteredItems.length - 1),
    );
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
    if (selectedIndex >= height) {
      startIdx = selectedIndex - height + 1;
    }

    for (let i = 0; i < height && startIdx + i < filteredItems.length; i++) {
      const idx = startIdx + i;
      const item = filteredItems[idx]!;
      const isSelected = idx === selectedIndex;
      const formatted = config.formatItem(item, width);
      const text = " " + truncateAnsi(formatted, width - 2);
      const padded = ensureWidth(text, width);
      rows.push(isSelected ? theme.fg("accent", theme.bold(padded)) : padded);
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

    const searchDisplay = searchQuery
      ? ` Search: ${truncateAnsi(searchQuery, dims.leftW - 10)}`
      : ` ${config.title}`;
    const itemCount = `(${filteredItems.length}/${items.length})`;
    const leftTitle = truncateAnsi(`${searchDisplay} ${itemCount}`, dims.leftW);

    const selectedItem = filteredItems[selectedIndex];
    const rightTitle = selectedItem?.path
      ? ` ${truncateAnsi(selectedItem.path, dims.rightW - 2)}`
      : " Source Preview";

    const itemRows = getItemRows(dims.leftW, dims.contentH);
    const sourceRows = renderSourceRows(
      sourceLines,
      dims.rightW,
      dims.contentH,
      sourceScroll,
      theme,
      selectedItem?.startLine && selectedItem?.endLine
        ? { start: selectedItem.startLine, end: selectedItem.endLine }
        : undefined,
    );

    const baseParts = config.helpParts ?? ["↑↓ nav", "type to search"];
    const helpText = buildHelpText(
      ...baseParts,
      filteredItems.length > 0 && "enter select",
      filteredItems.length > 0 && config.onEdit && "ctrl+e edit",
      "esc",
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

    if (matchesKey(data, "enter")) {
      const item = filteredItems[selectedIndex];
      done(item || null);
      return;
    }

    if (matchesKey(data, "ctrl+e")) {
      const item = filteredItems[selectedIndex];
      if (item && config.onEdit) {
        void Promise.resolve(config.onEdit(item));
      }
      return;
    }

    if (matchesKey(data, "up")) {
      if (selectedIndex > 0) {
        selectedIndex--;
        const item = filteredItems[selectedIndex];
        if (item) void loadPreview(item);
        invalidate();
        tui.requestRender();
      }
      return;
    }

    if (matchesKey(data, "down")) {
      if (selectedIndex < filteredItems.length - 1) {
        selectedIndex++;
        const item = filteredItems[selectedIndex];
        if (item) void loadPreview(item);
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
      selectedIndex = Math.max(0, selectedIndex - dims.contentH);
      const item = filteredItems[selectedIndex];
      if (item) void loadPreview(item);
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
      selectedIndex = Math.min(
        filteredItems.length - 1,
        selectedIndex + dims.contentH,
      );
      const item = filteredItems[selectedIndex];
      if (item) void loadPreview(item);
      invalidate();
      tui.requestRender();
      return;
    }

    // Backspace - delete from search query
    if (data === "\x7f" || data === "\b") {
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        filterItems();
        const item = filteredItems[selectedIndex];
        if (item) void loadPreview(item);
        invalidate();
        tui.requestRender();
      }
      return;
    }

    // Printable characters - add to search query
    if (data.length === 1 && data >= " " && data <= "~") {
      searchQuery += data;
      filterItems();
      const item = filteredItems[selectedIndex];
      if (item) void loadPreview(item);
      invalidate();
      tui.requestRender();
      return;
    }
  }

  function dispose(): void {
    previewCache.clear();
  }

  void loadItems();

  return { render, handleInput, dispose };
}
