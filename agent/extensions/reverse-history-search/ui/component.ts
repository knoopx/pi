import { fuzzyMatch } from "../../../shared/matching/fuzzy";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";
import type { TUI } from "@earendil-works/pi-tui";
import { renderHistoryPage } from "./renderer";
import type { HistoryEntry, HistoryFilter } from "../types";

const HISTORY_FILTERS: HistoryFilter[] = [
  { name: "Messages", type: "message" },
  { name: "Commands", type: "command" },
];

const keyHandlers: Record<string, (self: HistorySearchComponent) => void> = {
  escape: (self) => self.handleEscape(),
  enter: (self) => self.handleEnter(),
  pageUp: (self) => self.handlePageUp(),
  pageDown: (self) => self.handlePageDown(),
  home: (self) => self.handleHome(),
  end: (self) => self.handleEnd(),
  up: (self) => self.handleUp(),
  down: (self) => self.handleDown(),
  "ctrl+/": (self) => self.cycleFilter(1),
  backspace: (self) => self.handleBackspace(),
  delete: (self) => self.handleBackspace(),
};

const allKeys = Object.keys(keyHandlers);

export class HistorySearchComponent {
  private allHistory: HistoryEntry[];
  private filteredHistory: HistoryEntry[];
  private query = "";
  private selectedIndex = 0;
  private filterIndex = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];

  public onSelect?: (entry: HistoryEntry) => void;
  public onCancel?: () => void;

  constructor(
    private theme: Theme,
    history: HistoryEntry[],
  ) {
    this.allHistory = history;
    this.filteredHistory = history;
  }

  getFilterName(): string {
    return HISTORY_FILTERS[this.filterIndex]?.name ?? "Messages";
  }

  private getPageOffset(): number {
    return 10;
  }

  private tryHandleKey(data: string): boolean {
    for (const key of allKeys) {
      if (matchesKey(data, key as import("@earendil-works/pi-tui").KeyId)) {
        keyHandlers[key](this);
        return true;
      }
    }
    return false;
  }

  handleInput(data: string): void {
    if (this.tryHandleKey(data)) return;
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      this.handleCharacter(data);
    }
  }

  handleEscape(): void {
    this.onCancel?.();
  }

  handleEnter(): void {
    if (this.filteredHistory.length > 0)
      this.onSelect?.(this.filteredHistory[this.selectedIndex]);
  }

  handleUp(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.invalidate();
    }
  }

  handleDown(): void {
    if (this.selectedIndex < this.filteredHistory.length - 1) {
      this.selectedIndex++;
      this.invalidate();
    }
  }

  handlePageUp(): void {
    const offset = this.getPageOffset();
    const newIndex = Math.max(0, this.selectedIndex - offset);
    if (newIndex !== this.selectedIndex) {
      this.selectedIndex = newIndex;
      this.invalidate();
    }
  }

  handlePageDown(): void {
    const offset = this.getPageOffset();
    const maxIndex = this.filteredHistory.length - 1;
    const newIndex = Math.min(maxIndex, this.selectedIndex + offset);
    if (newIndex !== this.selectedIndex) {
      this.selectedIndex = newIndex;
      this.invalidate();
    }
  }

  handleHome(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex = 0;
      this.invalidate();
    }
  }

  handleEnd(): void {
    const maxIndex = this.filteredHistory.length - 1;
    if (this.selectedIndex < maxIndex) {
      this.selectedIndex = maxIndex;
      this.invalidate();
    }
  }

  cycleFilter(direction: 1 | -1): void {
    this.filterIndex =
      (this.filterIndex + direction + HISTORY_FILTERS.length) %
      HISTORY_FILTERS.length;
    this.selectedIndex = 0;
    this.updateFilter();
  }

  handleBackspace(): void {
    if (this.query.length > 0) {
      this.query = this.query.slice(0, -1);
      this.updateFilter();
    }
  }

  private handleCharacter(char: string): void {
    this.query += char;
    this.updateFilter();
  }

  private updateFilter(): void {
    const currentFilter = HISTORY_FILTERS[this.filterIndex];
    const matchesQuery = (entry: HistoryEntry): boolean =>
      this.query === "" || fuzzyMatch(entry.content, this.query);
    const matchesType = (entry: HistoryEntry): boolean =>
      entry.type === currentFilter.type;

    this.filteredHistory = this.allHistory.filter(
      (entry) => matchesQuery(entry) && matchesType(entry),
    );

    if (this.selectedIndex >= this.filteredHistory.length)
      this.selectedIndex = Math.max(0, this.filteredHistory.length - 1);

    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    const filterName = this.getFilterName();
    const lines = renderHistoryPage(
      this.filteredHistory,
      this.selectedIndex,
      width,
      this.query,
      this.theme,
      filterName,
    );
    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}

export function makeHistorySearchRenderer(
  theme: Theme,
  history: HistoryEntry[],
  done: (result: HistoryEntry | null) => void,
  tuiRef: TUI,
): {
  render(w: number): string[];
  invalidate(): void;
  handleInput(data: string): void;
} {
  const component = new HistorySearchComponent(theme, history);

  component.onSelect = (entry) => {
    done(entry);
  };
  component.onCancel = () => {
    done(null);
  };

  return {
    render(w: number) {
      return component.render(w);
    },
    invalidate() {
      component.invalidate();
    },
    handleInput(data: string) {
      component.handleInput(data);
      tuiRef.requestRender();
    },
  };
}
