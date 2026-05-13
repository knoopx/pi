import type { ChangesState } from "./state";
import { computeNewIndex } from "../../lib/list-picker/navigation";
export interface NavigationCallbacks {
  onChangeSelected: (changeId: string) => void | Promise<void>;
  onFileSelected?: (filePath: string) => void | Promise<void>;
  onSwitchFocus?: (focus: "left" | "right") => void;
}
export class Navigation {
  scrollPageOffset = 10;

  constructor(
    private state: ChangesState,
    private tui: { requestRender: () => void },
    private callbacks: NavigationCallbacks,
  ) {}

  onChangeSelected(changeId: string): void | Promise<void> {
    return this.callbacks.onChangeSelected(changeId);
  }

  navigateChanges(dir: "up" | "down" | "pageUp" | "pageDown"): void {
    this.navigateList(
      this.state.changes,
      this.state.selectionState.selectedIndex,
      (idx) => (this.state.selectionState.selectedIndex = idx),
      (item) => {
        this.state.selectedChange = item;
        void this.callbacks.onChangeSelected(item.changeId);
      },
      dir,
    );
  }

  navigateFiles(dir: "up" | "down" | "pageUp" | "pageDown"): void {
    if (!this.state.selectedChange) return;
    this.navigateList(
      this.state.files,
      this.state.selectionState.fileIndex,
      (idx) => (this.state.selectionState.fileIndex = idx),
      (item) => {
        void this.callbacks.onFileSelected?.(item.path);
      },
      dir,
    );
  }

  private navigateList<T>(
    items: T[],
    currentIndex: number,
    setIndex: (idx: number) => void,
    onSelect: (item: T) => void,
    dir: "up" | "down" | "pageUp" | "pageDown",
  ): void {
    if (items.length === 0) return;
    const maxIndex = items.length - 1;
    const pageOffset =
      this.state.rightListHeight > 1
        ? this.state.rightListHeight - 1
        : this.scrollPageOffset;
    const newIndex = this.calcNewIndex(currentIndex, dir, maxIndex, pageOffset);

    if (newIndex !== currentIndex) {
      setIndex(newIndex);
      onSelect(items[newIndex]);
    }
  }

  scrollDiff(dir: "up" | "down"): void {
    const offset =
      this.state.rightListHeight > 1
        ? this.state.rightListHeight - 1
        : this.scrollPageOffset;
    const maxScroll = Math.max(0, this.state.diffContent.length - offset);
    if (dir === "down") {
      this.state.selectionState.diffScroll = Math.min(
        maxScroll,
        this.state.selectionState.diffScroll + offset,
      );
    } else {
      this.state.selectionState.diffScroll = Math.max(
        0,
        this.state.selectionState.diffScroll - offset,
      );
    }
  }

  switchFocus(): void {
    this.state.selectionState.focus =
      this.state.selectionState.focus === "left" ? "right" : "left";
    this.callbacks.onSwitchFocus?.(this.state.selectionState.focus);
  }

  toggleSelection(): void {
    if (!this.state.selectedChange) return;
    const id = this.state.selectedChange.changeId;
    if (this.state.selectedChangeIds.has(id)) {
      this.state.selectedChangeIds.delete(id);
    } else {
      this.state.selectedChangeIds.add(id);
    }
  }

  enterMoveMode(): void {
    if (!this.state.selectedChange || this.state.changes.length < 2) return;
    this.state.mode = "move";
    this.state.moveOriginalIndex = this.state.selectionState.selectedIndex;
    this.state.moveOriginalChanges = [...this.state.changes];
  }

  cancelMoveMode(): void {
    this.state.changes = this.state.moveOriginalChanges;
    this.state.selectionState.selectedIndex = this.state.moveOriginalIndex;
    this.state.selectedChange =
      this.state.changes[this.state.moveOriginalIndex] ?? null;
    this.state.mode = "normal";
    this.state.moveOriginalIndex = -1;
    this.state.moveOriginalChanges = [];
  }

  cycleFilter(direction: 1 | -1, totalFilters: number): void {
    this.state.currentFilterIndex =
      (this.state.currentFilterIndex + direction + totalFilters) % totalFilters;
    this.state.selectionState.selectedIndex = 0;
    this.state.selectionState.fileIndex = 0;
    this.state.selectionState.diffScroll = 0;
  }

  moveChange(dir: "up" | "down"): void {
    const currentIndex = this.state.selectionState.selectedIndex;
    const targetIndex = dir === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= this.state.changes.length) return;
    const current = this.state.changes[currentIndex];
    const isWorkingCopy =
      this.state.currentChangeId !== null &&
      current.changeId === this.state.currentChangeId;
    if (isWorkingCopy) {
      return;
    }

    [this.state.changes[currentIndex], this.state.changes[targetIndex]] = [
      this.state.changes[targetIndex],
      this.state.changes[currentIndex],
    ];
    this.state.selectionState.selectedIndex = targetIndex;
  }

  private calcNewIndex(
    current: number,
    dir: string,
    maxIndex: number,
    pageOffset: number,
  ): number {
    return computeNewIndex(
      current,
      maxIndex,
      dir as "up" | "down" | "pageUp" | "pageDown",
      pageOffset,
    );
  }
}
