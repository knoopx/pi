import type { Theme } from "@mariozechner/pi-coding-agent";
import { ListRow } from "../../lib/split-panel/list-row";
import type { AgentWorkspace } from "../../lib/types";
import { formatFileStats } from "../../lib/formatters";
import { ensureWidth } from "../../lib/text-utils";

const STATUS_TEXT: Record<string, string> = {
  running: "running",
  completed: "done",
  failed: "failed",
  idle: "",
};

interface WorkspaceListPaneProps {
  workspaces: AgentWorkspace[];
  selectedIndex: number;
  focus: "left" | "right";
  loading: boolean;
  width: number;
  theme: Theme;
}


export class WorkspaceListPane {
  constructor(private readonly props: WorkspaceListPaneProps) {}

  render(width: number): string[] {
    if (this.props.loading) return [ensureWidth(" Loading...", width)];
    if (!this.props.workspaces.length) return this.renderEmptyState(width);
    return this.renderWorkspaceRows(width);
  }

  private renderEmptyState(width: number): string[] {
    return [
      ensureWidth(" No workspaces", width),
      ensureWidth(this.props.theme.fg("dim", " Use /workspace <task>"), width),
    ];
  }

  private renderWorkspaceRows(width: number): string[] {
    const rows: string[] = [];
    const { workspaces, selectedIndex, focus } = this.props;
    const maxRows = Math.min(workspaces.length, width);

    for (let i = 0; i < maxRows; i++) {
      rows.push(
        this.renderWorkspaceRow({
          ws: workspaces[i],
          index: i,
          selectedIndex,
          focus,
          width,
        }),
      );
    }
    return rows;
  }

  private renderWorkspaceRow(options: {
    ws: AgentWorkspace;
    index: number;
    selectedIndex: number;
    focus: string;
    width: number;
  }): string {
    const { ws, index, selectedIndex, focus, width } = options;
    const isSelected = index === selectedIndex && focus === "left";
    const statusLabel = this.getStatusLabel(ws);
    const text = ` ${ws.name} ${formatFileStats(ws)}${statusLabel}`;
    const row = new ListRow({ text, isSelected, theme: this.props.theme });
    return row.render(width)[0];
  }

  private getStatusLabel(ws: AgentWorkspace): string {
    if (ws.name === "default") return "";
    const label = STATUS_TEXT[ws.status];
    return label ? ` (${label})` : "";
  }

  invalidate(): void {}
  dispose(): void {}
}
