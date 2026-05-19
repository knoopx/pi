import type { Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import {
  calculateDimensions,
  DEFAULT_SPLIT_CONFIG,
} from "../../lib/split-panel/layout";
import { renderSplitPanel } from "../../lib/split-panel/border/renderer";
import { WorkspaceListPane } from "./list-pane";
import { computeWorkspaceViewTitles } from "./view-titles";
import { createRightPanes } from "./right-panes";
import type { WorkspaceViewProps } from "./types";
export class WorkspaceView implements Component {
  constructor(
    private readonly props: WorkspaceViewProps,
    private readonly tui: {
      terminal: { rows: number };
      requestRender: () => void;
    },
    private readonly theme: Theme,
  ) {}

  render(width: number): string[] {
    const dims = calculateDimensions(this.tui.terminal.rows, width, {
      ...DEFAULT_SPLIT_CONFIG,
      leftTitle: "",
      rightTitle: "",
      helpText: this.props.helpText,
      leftFocus: this.props.focus === "left",
      rightFocus: this.props.focus === "right",
    });
    const titles = computeWorkspaceViewTitles(
      this.props.selectedWorkspace,
      this.props.files,
      this.props.changes,
      this.props.fileIndex,
    );
    const leftPane = new WorkspaceListPane({
      workspaces: this.props.workspaces,
      selectedIndex: this.props.selectedIndex,
      focus: this.props.focus,
      loading: this.props.loading,
      width: dims.leftW,
      theme: this.theme,
    });
    const rightTopH = dims.rightTopH ?? 5;
    const rightBottomH = dims.rightBottomH ?? 10;
    const { rightTop, rightBottom } = createRightPanes({
      selectedWorkspace: this.props.selectedWorkspace,
      files: this.props.files,
      changes: this.props.changes,
      fileIndex: this.props.fileIndex,
      diffContent: this.props.diffContent,
      diffScroll: this.props.diffScroll,
      loading: this.props.loading,
      focus: this.props.focus,
      rightTopH,
      rightBottomH,
      rightW: dims.rightW,
      rightBottomTitle: titles.rightBottomTitle,
      theme: this.theme,
    });

    return renderSplitPanel(
      this.theme,
      {
        leftTitle: titles.leftTitle,
        rightTitle: titles.rightTopTitle,
        rightTopTitle: titles.rightTopTitle,
        rightBottomTitle: titles.rightBottomTitle,
        helpText: this.props.helpText,
        leftFocus: this.props.focus === "left",
        rightFocus: this.props.focus === "right",
        rightSplit: true,
      },
      dims,
      {
        left: leftPane.render(dims.leftW),
        rightTop,
        rightBottom,
      },
    );
  }

  invalidate(): void {}
}
