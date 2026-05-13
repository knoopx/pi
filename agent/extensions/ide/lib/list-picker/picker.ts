import type { Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { createKeyboardHandler } from "../../lib/keyboard/handler";
import {
  truncateAnsi,
  ensureWidth,
  pad,
} from "../../../../shared/format/ansi-text";
import { applyFocusedStyle } from "../ui/theme";
import { calculateDimensions } from "../split-panel/layout";
import { renderSplitPanel } from "../split-panel/border/renderer";
import { renderSourceRows } from "../split-panel/content";
import { createStatusNotifier, formatHelpWithStatus } from "../ui/status";
import type { StatusMessageState } from "../ui/status";

import type {
  ListPickerItem,
  ListPickerAction,
  ListPickerConfig,
  ListPickerComponent,
  ListPickerOptions,
} from "./types";
export type {
  ListPickerItem,
  ListPickerAction,
  ListPickerConfig,
  ListPickerComponent,
  ListPickerOptions,
};
import { buildPickerTitles } from "./titles";
import { getActionBindings, getCoreBindings, getHelpText } from "./bindings";

class ListPickerImpl<T extends ListPickerItem>
  implements Component, ListPickerComponent
{
  private tui: NonNullable<ListPickerOptions<T>["tui"]>;
  private theme: Theme;
  private done: (result: T | null) => void;
  private config: ListPickerConfig<T>;
  private items: T[] = [];
  private filteredItems: T[] = [];
  private _focusedIndex = 0;
  private searchQuery: string;
  private sourceLines: string[] = [];
  private sourceScroll = 0;
  private loading = true;
  private error: string | null = null;
  private listHeight = 0;
  private previewCache = new Map<string, string[]>();
  private statusState: StatusMessageState = { message: null, timeout: null };
  private reloadTimeout: ReturnType<typeof setTimeout> | null = null;

  private keyboardHandler: (data: string) => void;
  notify = (_message: string, _type?: "info" | "error") => {};

  constructor(options: ListPickerOptions<T>) {
    const { tui, theme, done, initialQuery, config } = options;
    this.tui = tui;
    this.theme = theme;
    this.done = done;
    this.config = config;
    this.searchQuery = initialQuery;

    this.notify = createStatusNotifier(this.statusState, () => {
      this.invalidate();
      this.tui.requestRender();
    });
    const actionBindings = getActionBindings(
      this.config,
      { getFilteredItems: () => this.filteredItems },
      () => this.getFocusedItem(),
    );
    const coreBindings = getCoreBindings(
      {
        navigate: (dir) => this.navigate(dir),
        done: (r) => this.done(r),
        scrollPreview: (dir) => this.scrollPreview(dir),
        onEdit: this.config.onEdit,
      },
      {
        getFilteredItems: () => this.filteredItems,
        config: this.config,
        getFocusedItem: () => this.getFocusedItem(),
      },
    );
    const allBindings = [...coreBindings, ...actionBindings];

    this.keyboardHandler = createKeyboardHandler({
      bindings: allBindings,
      onBackspace: () => {
        if (this.searchQuery.length > 0) {
          this.searchQuery = this.searchQuery.slice(0, -1);
          this.updateSearch();
        }
      },
      onTextInput: (char: string) => {
        this.searchQuery += char;
        this.updateSearch();
      },
    });

    void this.loadItemsWithQuery(initialQuery);
  }

  invalidate(): void {
    this.previewCache.clear();
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
    const lower = this.searchQuery.toLowerCase();
    this.filteredItems = this.config.filterItems(this.items, lower);
    this._focusedIndex = Math.min(
      this._focusedIndex,
      Math.max(0, this.filteredItems.length - 1),
    );
  }

  private getFocusedItem(): T | null {
    if (this.filteredItems.length === 0) return null;
    return this.filteredItems[this._focusedIndex];
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
      const result = await this.config.loadPreview(item);
      this.previewCache.set(cacheKey, result);
      this.sourceLines = result;
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
    if (this._focusedIndex >= height)
      startIdx = this._focusedIndex - height + 1;

    for (
      let i = 0;
      i < height && startIdx + i < this.filteredItems.length;
      i++
    ) {
      const idx = startIdx + i;
      const item = this.filteredItems[idx];
      const isFocused = idx === this._focusedIndex;
      const formatted = this.config.formatItem(item, width - 1, this.theme);
      const text = ` ${formatted}`;
      if (isFocused) {
        rows.push(
          applyFocusedStyle(this.theme, truncateAnsi(text, width), true, width),
        );
      } else {
        rows.push(ensureWidth(text, width));
      }
    }

    return rows;
  }

  render(width: number): string[] {
    const dims = calculateDimensions(this.tui.terminal.rows, width, {
      leftTitle: "",
      rightTitle: "",
      helpText: "",
      leftFocus: true,
    });

    this.listHeight = dims.contentH;
    const focusedItem = this.getFocusedItem();
    const { leftTitle, rightTitle } = buildPickerTitles({
      config: this.config,
      searchQuery: this.searchQuery,
      focusedItem,
      filteredCount: this.filteredItems.length,
      totalCount: this.items.length,
      leftW: dims.leftW,
      rightW: dims.rightW,
    });
    const itemRows = this.getItemRows(dims.leftW, dims.contentH);
    const sourceRows = this.getSourceRows(
      dims.rightW,
      dims.contentH,
      focusedItem?.startLine && focusedItem.endLine
        ? { start: focusedItem.startLine, end: focusedItem.endLine }
        : undefined,
    );
    const helpText = formatHelpWithStatus(
      this.theme,
      this.statusState.message,
      this.getHelpText(),
    );

    return renderSplitPanel(
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
  }

  private navigate(direction: "up" | "down" | "pageUp" | "pageDown"): void {
    const pageOffset = Math.max(1, this.listHeight - 1);
    const newIndex =
      direction === "up"
        ? Math.max(0, this._focusedIndex - 1)
        : direction === "pageUp"
          ? Math.max(0, this._focusedIndex - pageOffset)
          : direction === "pageDown"
            ? Math.min(
                this.filteredItems.length - 1,
                this._focusedIndex + pageOffset,
              )
            : Math.min(this.filteredItems.length - 1, this._focusedIndex + 1);
    if (newIndex !== this._focusedIndex) {
      this._focusedIndex = newIndex;
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

  private getHelpText(): string {
    const coreBindings = getCoreBindings(
      { navigate: () => {}, done: () => {}, scrollPreview: () => {} },
      {
        getFilteredItems: () => this.filteredItems,
        config: this.config,
        getFocusedItem: () => this.getFocusedItem(),
      },
    );
    const actionBindings = getActionBindings(
      this.config,
      { getFilteredItems: () => this.filteredItems },
      () => this.getFocusedItem(),
    );
    return getHelpText([...coreBindings, ...actionBindings]);
  }

  handleInput(data: string): void {
    if (
      this.config.onKey?.(data, () => {
        void this.reload();
      })
    )
      return;
    this.keyboardHandler(data);
  }

  get focusedIndex(): number {
    return this._focusedIndex;
  }

  set focusedIndex(index: number) {
    const clamped = Math.max(0, Math.min(index, this.filteredItems.length - 1));
    if (clamped !== this._focusedIndex) {
      this._focusedIndex = clamped;
      const item = this.getFocusedItem();
      if (item !== null) void this.loadPreview(item);
      this.invalidate();
      this.tui.requestRender();
    }
  }

  dispose(): void {
    this.previewCache.clear();
  }

  setPreview(lines: string[]): void {
    this.sourceLines = lines;
    this.sourceScroll = 0;
    this.invalidate();
    this.tui.requestRender();
  }

  private getSourceRows(
    width: number,
    height: number,
    highlightRange?: { start: number; end: number },
  ): string[] {
    return renderSourceRows({
      lines: this.sourceLines,
      width,
      height,
      scroll: this.sourceScroll,
      theme: this.theme,
      highlightRange,
    });
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.invalidate();
    this.tui.requestRender();
    await this.loadItemsWithQuery(this.searchQuery);
  }

  clearSearchQuery(): void {
    this.searchQuery = "";
    this.filterItems();
    this.invalidate();
    this.tui.requestRender();
  }

  getSearchQuery(): string {
    return this.searchQuery;
  }
}

export function createListPicker<T extends ListPickerItem>(
  options: ListPickerOptions<T>,
): ListPickerComponent {
  return new ListPickerImpl(options);
}
