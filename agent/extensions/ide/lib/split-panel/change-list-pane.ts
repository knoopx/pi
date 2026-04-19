import type { Theme } from "@mariozechner/pi-coding-agent";
import type { GraphLayout } from "../graph";
import { ChangeRow, type ChangeRowFlags } from "./change-row";
import { ensureWidth, getVisibleItems } from "../text-utils";

interface ChangeListPaneProps {
  changes: Array<{
    changeId: string;
    immutable: boolean;
    description: string;
    author?: string;
  }>;
  selectedIndex: number;
  selectedChangeIds: Set<string>;
  currentChangeId: string | null;
  bookmarksByChange: Map<string, string[]>;
  graphLayout: GraphLayout | null;
  loadingState: { loading: boolean };
  focus: "left" | "right";
  side?: "left" | "right";
  filterName?: string;
  mode?: "normal" | "move";
  moveOriginalIndex?: number;
  height: number;
  theme: Theme;
}


export class ChangeListPane {
  constructor(private readonly props: ChangeListPaneProps) {}

  render(width: number): string[] {
    if (this.props.loadingState.loading) {
      return [ensureWidth(this.props.theme.fg("dim", " Loading..."), width)];
    }

    if (this.props.changes.length === 0) {
      return [ensureWidth(this.props.theme.fg("dim", " No changes"), width)];
    }

    const visibleItems = getVisibleItems(
      this.props.changes,
      this.props.selectedIndex,
      this.props.height,
    );

    const rows: string[] = [];

    for (const { item: change, index: idx } of visibleItems) {
      const isCursor = idx === this.props.selectedIndex;
      const isMarked = this.props.selectedChangeIds.has(change.changeId);
      const isFocused =
        isCursor && this.props.focus === (this.props.side ?? "left");
      const isWorkingCopy = this.props.currentChangeId === change.changeId;
      const isMoving =
        this.props.mode === "move" && idx === this.props.selectedIndex;

      const flags: ChangeRowFlags = {
        isCursor,
        isMarked,
        isFocused,
        isWorkingCopy,
        isMoving,
      };
      const bookmarks = this.props.bookmarksByChange.get(change.changeId) ?? [];
      const row = new ChangeRow({
        change,
        idx,
        flags,
        bookmarks,
        theme: this.props.theme,
        layout: this.props.graphLayout,
      });
      rows.push(row.render(width)[0]);
    }

    return rows;
  }

  invalidate(): void {}
  dispose(): void {}
}
