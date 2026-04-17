import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { ListRow } from "../split-panel/list-row";
import { CachedPane } from "../split-panel/utils";
import type { AgentWorkspace } from "../../types";
import { formatFileStats } from "../../types";
import { ensureWidth } from "../text-utils";

const STATUS_TEXT: Record<string, string> = {
  running: "running",
  completed: "done",
  failed: "failed",
  idle: "",
};

export interface WorkspaceListPaneProps {
  workspaces: AgentWorkspace[];
  selectedIndex: number;
  focus: "left" | "right";
  loading: boolean;
  width: number;
  theme: Theme;
}

/** Left pane for workspace view — lists available workspaces. */
export class WorkspaceListPane extends CachedPane {
  constructor(private readonly props: WorkspaceListPaneProps) {
    super();
  }

  protected renderContent(width: number): string[] {
    if (this.props.loading) {
      return [ensureWidth(" Loading...", width)];
    }

    if (this.props.workspaces.length === 0) {
      return [
        ensureWidth(" No workspaces", width),
        ensureWidth(
          this.props.theme.fg("dim", " Use /workspace <task>"),
          width,
        ),
      ];
    }

    const rows: string[] = [];
    for (let i = 0; i < this.props.workspaces.length && i < width; i++) {
      const ws = this.props.workspaces[i];
      const isSelected =
        i === this.props.selectedIndex && this.props.focus === "left";
      const stats = formatFileStats(ws);
      const status =
        ws.name !== "default" && STATUS_TEXT[ws.status]
          ? ` (${STATUS_TEXT[ws.status]})`
          : "";
      const text = ` ${ws.name} ${stats}${status}`;
      const row = new ListRow({
        text,
        isSelected,
        theme: this.props.theme,
      });
      rows.push(row.render(width)[0]);
    }

    return rows;
  }
}
