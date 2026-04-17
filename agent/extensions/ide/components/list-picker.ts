import type { Component } from "@mariozechner/pi-tui";
import type {
  ExtensionAPI,
  KeybindingsManager,
} from "@mariozechner/pi-coding-agent";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import {
  createKeyboardHandler,
  buildHelpFromBindings,
  type KeyBinding,
} from "../keyboard";
import { truncateAnsi, ensureWidth, pad } from "./text-utils";
import {
  calculateDimensions,
  renderSplitPanel,
  renderSourceRows,
} from "./split-panel/index";
import { isRenderCacheValid } from "./state/factories";
import { createBaseDimensionsConfig } from "./state/navigation";
import {
  createStatusNotifier,
  formatHelpWithStatus,
  type StatusMessageState,
} from "./ui/status";

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

interface ListPickerConfig<T extends ListPickerItem> {
  title: string | (() => string);
  /** Load items, optionally filtered by query */
  loadItems: (query: string) => Promise<T[]>;
  /** Local filtering (used when query changes between loads) */
  filterItems: (items: T[], query: string) => T[];
  formatItem: (item: T, width: number, theme: Theme) => string;
  loadPreview: (item: T) => Promise<string[]>;
  previewTitle?: (item: T) => string;
  onEdit?: (item: T) => Promise<void> | void;
  actions?: ListPickerAction<T>[];
  /** Debounce delay for reloading on query change (0 = no reload, default) */
  reloadDebounceMs?: number;
  /** Custom key handler, return true if handled */
  onKey?: (key: string) => boolean;
}

interface ListPickerTui {
  terminal: { rows: number };
  requestRender: () => void;
}

export interface ListPickerComponent<
  T extends ListPickerItem = ListPickerItem,
> {
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
): ListPickerComponent<T> {
  const component = new ListPickerImpl(tui, theme, done, initialQuery, config);
  return component as unknown as ListPickerComponent<T>;
}

class ListPickerImpl<T extends ListPickerItem> implements Component {
  private items: T[] = [];
  private filteredItems: T[] = [];
  private focusedIndex = 0;
  private searchQuery: string;
  private sourceLines: string[] = [];
  private sourceScroll = 0;
  private loading = true;
  private error: string | null = null;
  private cachedLines: string[] = [];
  private cachedWidth = 0;
  private listHeight = 0;
  private previewCache = new Map<string, string[]>();
  private statusState: StatusMessageState = { message: null, timeout: null };
  private reloadTimeout: ReturnType<typeof setTimeout> | null = null;

  private keyboardHandler: (data: string) => void;
  private notify!: (message: string, type?: "info" | "error") => void;

  constructor(
    private tui: ListPickerTui,
    private theme: Theme,
    private done: (result: T | null) => void,
    initialQuery: string,
    private config: ListPickerConfig<T>,
  ) {
    this.searchQuery = initialQuery;

    this.notify = createStatusNotifier(this.statusState, () => {
      this.invalidate();
      this.tui.requestRender();
    });

    const actionBindings = this.getActionBindings();
    const coreBindings = this.getCoreBindings();
    const allBindings = [...coreBindings, ...actionBindings];

    this.keyboardHandler = createKeyboardHandler({
      bindings: allBindings as KeyBinding[],
      onBackspace: () => {
        if (this.searchQuery.length > 0) {
          this.searchQuery = this.searchQuery.slice(0, -1);
          this.updateSearch();
        }
      },
      onTextInput: (char) => {
        this.searchQuery += char;
        this.updateSearch();
      },
    });

    void this.loadItemsWithQuery(initialQuery);
  }

  invalidate(): void {
    this.cachedLines = [];
    this.cachedWidth = 0;
  }

  private async loadItemsWithQuery(query: string): Promise<void> {
    try {
      this.items = await this.config.loadItems(query);
      this.filterItems();
      this.loading = false;

      if (this.filteredItems.length > 0)
        void this.loadPreview(this.filteredItems[0]);

      this.invalidate();
      this.tui.requestRender();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.loading = false;
      this.invalidate();
      this.tui.requestRender();
    }
  }

  private scheduleReload(query: string): void {
    if (!this.config.reloadDebounceMs) return;
    if (this.reloadTimeout) clearTimeout(this.reloadTimeout);
    this.reloadTimeout = setTimeout(() => {
      void this.loadItemsWithQuery(query);
    }, this.config.reloadDebounceMs);
  }

  private filterItems(): void {
    if (!this.searchQuery) this.filteredItems = this.items;
    else {
      const lower = this.searchQuery.toLowerCase();
      this.filteredItems = this.config.filterItems(this.items, lower);
    }
    this.focusedIndex = Math.min(
      this.focusedIndex,
      Math.max(0, this.filteredItems.length - 1),
    );
  }

  private getFocusedItem(): T | null {
    if (this.filteredItems.length === 0) return null;
    return this.filteredItems[this.focusedIndex];
  }

  private async loadPreview(item: T): Promise<void> {
    const cacheKey = item.path ?? item.id;
    const cached = this.previewCache.get(cacheKey);
    if (cached) {
      this.sourceLines = cached;
      this.sourceScroll = item.startLine ? Math.max(0, item.startLine - 3) : 0;
      this.invalidate();
      this.tui.requestRender();
      return;
    }

    try {
      const lines = await this.config.loadPreview(item);
      this.previewCache.set(cacheKey, lines);
      this.sourceLines = lines;
      this.sourceScroll = item.startLine ? Math.max(0, item.startLine - 3) : 0;
      this.invalidate();
      this.tui.requestRender();
    } catch {
      this.sourceLines = [];
      this.invalidate();
      this.tui.requestRender();
    }
  }

  private getItemRows(width: number, height: number): string[] {
    const rows: string[] = [];

    if (this.loading) {
      rows.push(this.theme.fg("dim", pad(" Loading...", width)));
      return rows;
    }

    if (this.error) {
      rows.push(this.theme.fg("error", pad(` Error: ${this.error}`, width)));
      return rows;
    }

    if (this.filteredItems.length === 0) {
      rows.push(this.theme.fg("dim", pad(" No items found", width)));
      return rows;
    }

    let startIdx = 0;
    if (this.focusedIndex >= height) startIdx = this.focusedIndex - height + 1;

    for (
      let i = 0;
      i < height && startIdx + i < this.filteredItems.length;
      i++
    ) {
      const idx = startIdx + i;
      const item = this.filteredItems[idx];
      const isFocused = idx === this.focusedIndex;
      const formatted = this.config.formatItem(item, width - 1, this.theme);
      const text = ` ${formatted}`;
      if (isFocused) {
        const styled = this.theme.fg(
          "accent",
          this.theme.bold(truncateAnsi(text, width)),
        );
        rows.push(this.theme.bg("selectedBg", ensureWidth(styled, width)));
      } else {
        rows.push(ensureWidth(text, width));
      }
    }

    return rows;
  }

  render(width: number): string[] {
    if (isRenderCacheValid(width, this.cachedWidth, this.cachedLines))
      return this.cachedLines;

    const dims = calculateDimensions(
      this.tui.terminal.rows,
      width,
      createBaseDimensionsConfig(true),
    );

    this.listHeight = dims.contentH;

    const titleText =
      typeof this.config.title === "function"
        ? this.config.title()
        : this.config.title;
    const searchDisplay = this.searchQuery
      ? ` Search: ${truncateAnsi(this.searchQuery, dims.leftW - 10)}`
      : ` ${titleText}`;
    const itemCount = `(${String(this.filteredItems.length)}/${String(this.items.length)})`;
    const leftTitle = truncateAnsi(`${searchDisplay} ${itemCount}`, dims.leftW);

    const focusedItem = this.getFocusedItem();
    const previewTitleText = focusedItem
      ? (this.config.previewTitle?.(focusedItem) ?? focusedItem.path)
      : undefined;
    const rightTitle = previewTitleText
      ? ` ${truncateAnsi(previewTitleText, dims.rightW - 2)}`
      : " Source Preview";

    const itemRows = this.getItemRows(dims.leftW, dims.contentH);
    const sourceRows = renderSourceRows(
      this.sourceLines,
      dims.rightW,
      dims.contentH,
      this.sourceScroll,
      this.theme,
      focusedItem?.startLine && focusedItem.endLine
        ? { start: focusedItem.startLine, end: focusedItem.endLine }
        : undefined,
    );

    const helpText = formatHelpWithStatus(
      this.theme,
      this.statusState.message,
      this.getHelpText(),
    );

    this.cachedLines = renderSplitPanel(
      this.theme,
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

    this.cachedWidth = width;
    return this.cachedLines;
  }

  private navigate(direction: "up" | "down" | "pageUp" | "pageDown"): void {
    const pageOffset = Math.max(1, this.listHeight - 1);
    const newIndex =
      direction === "up"
        ? Math.max(0, this.focusedIndex - 1)
        : direction === "pageUp"
          ? Math.max(0, this.focusedIndex - pageOffset)
          : direction === "pageDown"
            ? Math.min(
                this.filteredItems.length - 1,
                this.focusedIndex + pageOffset,
              )
            : Math.min(this.filteredItems.length - 1, this.focusedIndex + 1);
    if (newIndex !== this.focusedIndex) {
      this.focusedIndex = newIndex;
      const item = this.getFocusedItem();
      if (item !== null) void this.loadPreview(item);
      this.invalidate();
      this.tui.requestRender();
    }
  }

  private scrollPreview(direction: "up" | "down"): void {
    if (this.sourceLines.length === 0) return;
    const dims = calculateDimensions(this.tui.terminal.rows, 100, {
      leftTitle: "",
      rightTitle: "",
      helpText: "",
      leftFocus: true,
    });
    const maxScroll = Math.max(0, this.sourceLines.length - dims.contentH);
    if (direction === "down")
      this.sourceScroll = Math.min(
        maxScroll,
        this.sourceScroll + dims.contentH,
      );
    else {
      this.sourceScroll = Math.max(0, this.sourceScroll - dims.contentH);
    }
    this.invalidate();
    this.tui.requestRender();
  }

  private updateSearch(): void {
    this.filterItems();
    this.scheduleReload(this.searchQuery);
    const item = this.getFocusedItem();
    if (item !== null) void this.loadPreview(item);
    this.invalidate();
    this.tui.requestRender();
  }

  private getActionBindings(): KeyBinding[] {
    return (this.config.actions ?? []).map((action) => ({
      key: action.key as KeyBinding["key"],
      label: action.label,
      when: () => this.filteredItems.length > 0,
      handler: async () => {
        const item = this.getFocusedItem();
        if (item !== null) await Promise.resolve(action.handler(item));
      },
    }));
  }

  private getCoreBindings(): KeyBinding[] {
    return [
      { key: "up", label: "nav", handler: () => this.navigate("up") },
      { key: "down", handler: () => this.navigate("down") },
      {
        key: "pageUp",
        label: "scroll",
        handler: () => this.navigate("pageUp"),
      },
      { key: "pageDown", handler: () => this.navigate("pageDown") },
      { key: "escape", handler: () => this.done(null) },
      {
        key: Key.ctrl("e"),
        label: "edit",
        when: () => this.config.onEdit !== undefined,
        handler: () => {
          const item = this.getFocusedItem();
          if (item !== null && this.config.onEdit)
            void Promise.resolve(this.config.onEdit(item));
        },
      },
      { key: "shift+pageUp", handler: () => this.scrollPreview("up") },
      { key: "shift+pageDown", handler: () => this.scrollPreview("down") },
    ];
  }

  private getHelpText(): string {
    const coreBindings = this.getCoreBindings();
    const actionBindings = this.getActionBindings();
    const allBindings = [...coreBindings, ...actionBindings];
    const activeBindings = allBindings.filter((b) => {
      if (!b.label) return false;
      if (b.when && !b.when(undefined as never)) return false;
      return true;
    });
    return buildHelpFromBindings(activeBindings);
  }

  handleInput(data: string): void {
    if (this.config.onKey?.(data)) return;
    this.keyboardHandler(data);
  }

  dispose(): void {
    this.previewCache.clear();
  }

  private setPreview(lines: string[]): void {
    this.sourceLines = lines;
    this.sourceScroll = 0;
    this.invalidate();
    this.tui.requestRender();
  }

  private async reload(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.invalidate();
    this.tui.requestRender();
    await this.loadItemsWithQuery(this.searchQuery);
  }

  private clearSearchQuery(): void {
    this.searchQuery = "";
    this.filterItems();
    this.invalidate();
    this.tui.requestRender();
  }
}
