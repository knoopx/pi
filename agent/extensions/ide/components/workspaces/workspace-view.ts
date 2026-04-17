import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { calculateDimensions, renderSplitPanel } from "../split-panel";
import { ChangeListPane } from "../split-panel/change-list-pane";
import { FileListPane } from "../split-panel/file-list-pane";
import { DiffPane } from "../split-panel/diff-pane";
import { WorkspaceListPane } from "./workspace-list-pane";
import type { AgentWorkspace, FileChange, Change } from "../../types";

const STATUS_TEXT: Record<string, string> = {
  running: "running",
  completed: "done",
  failed: "failed",
  idle: "",
};

export interface WorkspaceViewProps {
  workspaces: AgentWorkspace[];
  selectedWorkspace: AgentWorkspace | null;
  files: FileChange[];
  changes: Change[];
  fileIndex: number;
  diffContent: string[];
  diffScroll: number;
  focus: "left" | "right";
  selectedIndex: number;
  loading: boolean;
}

/** Workspace view — composite pane for listing workspaces with their files/diffs. */
export class WorkspaceView implements Component {
  private lastWidth = 0;
  private cachedLines: string[] | null = null;

  constructor(
    private readonly props: WorkspaceViewProps,
    private readonly tui: {
      terminal: { rows: number };
      requestRender: () => void;
    },
    private readonly theme: Theme,
  ) {}

  render(width: number): string[] {
    if (width === this.lastWidth && this.cachedLines) return this.cachedLines;
    this.lastWidth = width;
    this.cachedLines = null;

    const dims = calculateDimensions(this.tui.terminal.rows, width, {
      leftTitle: "",
      rightTitle: "",
      helpText: "",
      leftFocus: this.props.focus === "left",
      rightFocus: this.props.focus === "right",
      leftRatio: 0.28,
      rightSplit: true,
      rightTopRatio: 0.3,
    });

    const isDefault = this.props.selectedWorkspace?.name === "default";
    const leftTitle = " Workspaces";
    const rightTopTitle = isDefault ? " Changes" : " Files";
    let rightBottomTitle: string;
    if (!this.props.selectedWorkspace) {
      rightBottomTitle = " Diff";
    } else if (isDefault) {
      rightBottomTitle = ` Diff: ${this.props.changes[this.props.fileIndex]?.changeId?.slice(0, 8) ?? "none"}`;
    } else {
      rightBottomTitle = ` Diff: ${this.props.files[this.props.fileIndex]?.path ?? "all"}`;
    }

    const leftPane = new WorkspaceListPane({
      workspaces: this.props.workspaces,
      selectedIndex: this.props.selectedIndex,
      focus: this.props.focus,
      loading: this.props.loading,
      width: dims.leftW,
      theme: this.theme,
    });

    const rightTopPane = isDefault
      ? new ChangeListPane({
          changes: this.props.changes.map((c) => ({
            ...c,
            immutable: c.immutable ?? false,
            description: c.description,
            empty: c.empty ?? false,
          })),
          selectedIndex: this.props.fileIndex,
          selectedChangeIds: new Set(),
          currentChangeId: null,
          bookmarksByChange: new Map(),
          graphLayout: null,
          loadingState: { loading: this.props.loading },
          focus: this.props.focus,
          theme: this.theme,
        })
      : new FileListPane({
          files: this.props.files,
          selectedIndex: this.props.fileIndex,
          title: rightTopTitle,
          height: dims.rightTopH ?? 5,
          focus: this.props.focus,
          theme: this.theme,
        });

    const rightBottomPane = new DiffPane({
      lines: this.props.diffContent,
      scroll: this.props.diffScroll,
      width: dims.rightW,
      height: dims.rightBottomH ?? 10,
      title: rightBottomTitle,
      focus: this.props.focus,
      theme: this.theme,
    });

    const result = renderSplitPanel(
      this.theme,
      {
        leftTitle,
        rightTitle: rightTopTitle,
        rightTopTitle,
        rightBottomTitle,
        helpText: "",
        leftFocus: this.props.focus === "left",
        rightFocus: this.props.focus === "right",
        rightSplit: true,
      },
      dims,
      {
        left: leftPane.render(dims.leftW),
        rightTop: rightTopPane.render(dims.rightW),
        rightBottom: rightBottomPane.render(dims.rightW),
      },
    );

    this.cachedLines = result;
    return result;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.lastWidth = 0;
  }

  dispose(): void {}
}
