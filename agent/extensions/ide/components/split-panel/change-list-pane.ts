import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import type { GraphLayout } from "../graph";
import { ChangeRow, type ChangeRowFlags } from "./change-row";
import { ensureWidth } from "../text-utils";
import { CachedPane } from "./utils";

export interface ChangeListPaneProps {
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
  filterName?: string;
  mode?: "normal" | "move";
  moveOriginalIndex?: number;
  theme: Theme;
}

/** Left pane — change/commit list rendered as a pi-tui Component. */
export class ChangeListPane extends CachedPane implements Component {
  constructor(private readonly props: ChangeListPaneProps) {
    super();
  }

  protected renderContent(width: number): string[] {
    if (this.props.loadingState.loading) {
      return [ensureWidth(this.props.theme.fg("dim", " Loading..."), width)];
    }

    if (this.props.changes.length === 0) {
      return [ensureWidth(this.props.theme.fg("dim", " No changes"), width)];
    }

    const rows: string[] = [];

    for (let i = 0; i < this.props.changes.length; i++) {
      const change = this.props.changes[i];
      const isCursor = i === this.props.selectedIndex;
      const isMarked = this.props.selectedChangeIds.has(change.changeId);
      const isFocused = isCursor && this.props.focus === "left";
      const isWorkingCopy = this.props.currentChangeId === change.changeId;
      const isMoving =
        this.props.mode === "move" && i === this.props.selectedIndex;

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
        idx: i,
        flags,
        bookmarks,
        theme: this.props.theme,
        layout: this.props.graphLayout,
      });
      rows.push(row.render(width)[0]);
    }

    return rows;
  }
}
