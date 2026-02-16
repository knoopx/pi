import type { Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";
import { truncateAnsi, ensureWidth } from "./utils";

export interface ListItem {
  id: string;
}

export interface ListConfig<T extends ListItem> {
  items: T[];
  formatItem: (item: T, width: number, isFocused: boolean) => string;
  onSelect?: (item: T) => void;
  onFocusChange?: (item: T | null) => void;
}

export interface ListState {
  focusedIndex: number;
  scrollOffset: number;
}

export interface ListComponent<T extends ListItem> {
  render: (width: number, height: number, isFocused: boolean) => string[];
  handleInput: (data: string) => boolean;
  getFocusedItem: () => T | null;
  setItems: (items: T[]) => void;
  getState: () => ListState;
  setFocusedIndex: (index: number) => void;
}

export function createList<T extends ListItem>(
  theme: Theme,
  config: ListConfig<T>,
  onUpdate: () => void,
): ListComponent<T> {
  let items = config.items;
  let focusedIndex = 0;
  let scrollOffset = 0;

  function clampIndex(): void {
    if (items.length === 0) {
      focusedIndex = 0;
      return;
    }
    focusedIndex = Math.max(0, Math.min(focusedIndex, items.length - 1));
  }

  function ensureVisible(height: number): void {
    if (focusedIndex < scrollOffset) {
      scrollOffset = focusedIndex;
    } else if (focusedIndex >= scrollOffset + height) {
      scrollOffset = focusedIndex - height + 1;
    }
  }

  function getFocusedItem(): T | null {
    if (items.length === 0) return null;
    return items[focusedIndex] ?? null;
  }

  function navigate(direction: "up" | "down", height: number): boolean {
    if (items.length === 0) return false;

    const prevIndex = focusedIndex;
    if (direction === "up") {
      focusedIndex = Math.max(0, focusedIndex - 1);
    } else {
      focusedIndex = Math.min(items.length - 1, focusedIndex + 1);
    }

    if (prevIndex !== focusedIndex) {
      ensureVisible(height);
      config.onFocusChange?.(getFocusedItem());
      onUpdate();
      return true;
    }
    return false;
  }

  function render(width: number, height: number, isFocused: boolean): string[] {
    const rows: string[] = [];

    if (items.length === 0) {
      rows.push(ensureWidth(theme.fg("dim", " No items"), width));
      return rows;
    }

    ensureVisible(height);

    for (let i = 0; i < height && scrollOffset + i < items.length; i++) {
      const idx = scrollOffset + i;
      const item = items[idx];
      const isItemFocused = idx === focusedIndex && isFocused;
      const formatted = config.formatItem(item, width - 1, isItemFocused);
      const text = " " + truncateAnsi(formatted, width - 1);
      const padded = ensureWidth(text, width);

      if (idx === focusedIndex) {
        rows.push(isFocused ? theme.fg("accent", theme.bold(padded)) : padded);
      } else {
        rows.push(padded);
      }
    }

    return rows;
  }

  function handleInput(data: string): boolean {
    if (matchesKey(data, "up")) {
      return navigate("up", 10);
    }
    if (matchesKey(data, "down")) {
      return navigate("down", 10);
    }
    if (matchesKey(data, "enter")) {
      const item = getFocusedItem();
      if (item) {
        config.onSelect?.(item);
        return true;
      }
    }
    return false;
  }

  function setItems(newItems: T[]): void {
    items = newItems;
    clampIndex();
    onUpdate();
  }

  function setFocusedIndex(index: number): void {
    focusedIndex = index;
    clampIndex();
    onUpdate();
  }

  function getState(): ListState {
    return { focusedIndex, scrollOffset };
  }

  return {
    render,
    handleInput,
    getFocusedItem,
    setItems,
    getState,
    setFocusedIndex,
  };
}
