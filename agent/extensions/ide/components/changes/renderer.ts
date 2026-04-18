/**
 * Renderer — split-panel rendering for the changes browser.
 * Composes ChangeListPane, FileListPane, and DiffPane into a split layout.
 */

import type { Theme } from "@mariozechner/pi-coding-agent";
import type { ChangesState } from "./state";
import { calculateDimensions, renderSplitPanel } from "../split-panel";
import { REVISION_FILTERS } from "./types";
import { ChangeListPane } from "../split-panel/change-list-pane";
import { FileListPane } from "../split-panel/file-list-pane";
import { DiffPane } from "../split-panel/diff-pane";
import stringWidth from "string-width";

export class Renderer {
  private statusText: string | null = null;

  constructor(
    private readonly state: ChangesState,
    private readonly tui: {
      terminal: { rows: number };
      requestRender: () => void;
    },
    private readonly theme: Theme,
  ) {}

  render(width: number, helpText: string): string[] {
    const dims = calculateDimensions(this.tui.terminal.rows, width, {
      leftTitle: "",
      rightTitle: "",
      helpText: "",
      leftFocus: this.state.selectionState.focus === "left",
      rightFocus: this.state.selectionState.focus === "right",
      leftRatio: 0.28,
      rightSplit: true,
      rightTopRatio: 0.3,
    });

    const filterName =
      REVISION_FILTERS[this.state.currentFilterIndex % REVISION_FILTERS.length]
        ?.name ?? "Stack";
    const helpTextWithStatus = this.formatHelpText(helpText);

    const leftTitle = ` ${filterName} (${this.state.changes.length})`;
    const rightTopTitle = this.renderRightTopTitle(dims.rightW);
    const rightBottomTitle = this.renderRightBottomTitle();

    // Compose pane components
    const changePane = new ChangeListPane({
      changes: this.state.changes,
      selectedIndex: this.state.selectionState.selectedIndex,
      selectedChangeIds: this.state.selectedChangeIds,
      currentChangeId: this.state.currentChangeId,
      bookmarksByChange: this.state.bookmarksByChange,
      graphLayout: this.state.graphLayout,
      loadingState: this.state.loadingState,
      focus: this.state.selectionState.focus,
      filterName,
      mode: this.state.mode,
      moveOriginalIndex: this.state.moveOriginalIndex,
      height: dims.contentH,
      theme: this.theme,
    });

    const filePane = new FileListPane({
      files: this.state.files,
      selectedIndex: this.state.selectionState.fileIndex,
      title: rightTopTitle,
      height: dims.rightTopH ?? 5,
      focus: this.state.selectionState.focus,
      theme: this.theme,
    });

    const diffPane = new DiffPane({
      lines: this.state.diffContent,
      scroll: this.state.selectionState.diffScroll,
      width: dims.rightW,
      height: dims.rightBottomH ?? 10,
      title: rightBottomTitle,
      focus: this.state.selectionState.focus,
      theme: this.theme,
    });

    return renderSplitPanel(
      this.theme,
      {
        leftTitle,
        rightTitle: rightTopTitle,
        rightTopTitle,
        rightBottomTitle,
        helpText: helpTextWithStatus,
        leftFocus: this.state.selectionState.focus === "left",
        rightFocus: this.state.selectionState.focus === "right",
        rightSplit: true,
      },
      dims,
      {
        left: changePane.render(dims.leftW),
        rightTop: filePane.render(dims.rightW),
        rightBottom: diffPane.render(dims.rightW),
      },
    );
  }

  setStatusMsg(msg: string | null): void {
    this.statusText = msg;
    this.tui.requestRender();
  }

  private renderRightTopTitle(width: number): string {
    if (!this.state.selectedChange) return " Files";
    const id = this.state.selectedChange.changeId.slice(0, 8);
    const desc = this.state.selectedChange.description || "(no description)";
    const author = this.state.selectedChange.author
      ? ` ${this.theme.fg("dim", this.state.selectedChange.author)}`
      : "";

    // ANSI-aware padding: expand spaces between desc and author so the
    // author is pushed to the right edge of the title row.
    const idStr = this.theme.fg("dim", id);
    const visibleLen = stringWidth(idStr) + desc.length + stringWidth(author);
    const padLen = Math.max(0, width - 2 - visibleLen);
    return ` ${idStr} ${desc}${" ".repeat(padLen)}${author}`;
  }

  private renderRightBottomTitle(): string {
    if (!this.state.selectedChange) return " Diff";
    const file = this.state.files[this.state.selectionState.fileIndex];
    const path = file?.path ?? "all";
    const id = this.state.selectedChange.changeId.slice(0, 8);
    return ` Diff: ${path} (${id})`;
  }

  private formatHelpText(helpText: string): string {
    if (this.statusText) {
      return `${this.theme.fg("success", this.statusText)} ${helpText}`;
    }
    return helpText;
  }
}
