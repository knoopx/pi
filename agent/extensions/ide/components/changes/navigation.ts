import type { ChangesState } from "./state";
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
    const { changes } = this.state;
    if (changes.length === 0) return;
    const maxIndex = changes.length - 1;
    const pageOffset =
      this.state.rightListHeight > 1
        ? this.state.rightListHeight - 1
        : this.scrollPageOffset;
    const newIndex = this.calcNewIndex(
      this.state.selectionState.selectedIndex,
      dir,
      maxIndex,
      pageOffset,
    );

    if (newIndex !== this.state.selectionState.selectedIndex) {
      this.state.selectionState.selectedIndex = newIndex;
      this.state.selectedChange = changes[newIndex];
      void this.callbacks.onChangeSelected(changes[newIndex].changeId);
    }
  }

  navigateFiles(dir: "up" | "down" | "pageUp" | "pageDown"): void {
    const { files, selectedChange } = this.state;
    if (files.length === 0 || !selectedChange) return;
    const maxIndex = files.length - 1;
    const pageOffset =
      this.state.rightListHeight > 1
        ? this.state.rightListHeight - 1
        : this.scrollPageOffset;
    const newIndex = this.calcNewIndex(
      this.state.selectionState.fileIndex,
      dir,
      maxIndex,
      pageOffset,
    );

    if (newIndex !== this.state.selectionState.fileIndex) {
      this.state.selectionState.fileIndex = newIndex;
      void this.callbacks.onFileSelected?.(files[newIndex].path);
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
    switch (dir) {
      case "up":
        return Math.max(0, current - 1);
      case "pageUp":
        return Math.max(0, current - pageOffset);
      case "pageDown":
        return Math.min(maxIndex, current + pageOffset);
      default:
        return Math.min(maxIndex, current + 1);
    }
  }
}
