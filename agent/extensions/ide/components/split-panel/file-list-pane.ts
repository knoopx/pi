import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { FileChangeRow } from "./file-change-row";
import { ensureWidth } from "../text-utils";
import { CachedPane } from "./utils";

export interface FileListPaneProps {
  files: Array<{
    status: string;
    path: string;
    insertions?: number;
    deletions?: number;
  }>;
  selectedIndex: number;
  title: string;
  height: number;
  focus: "left" | "right";
  theme: Theme;
}

/** Right-top pane — file change list rendered as a pi-tui Component. */
export class FileListPane extends CachedPane implements Component {
  constructor(private readonly props: FileListPaneProps) {
    super();
  }

  protected renderContent(width: number): string[] {
    if (this.props.files.length === 0) {
      return [
        ensureWidth(this.props.theme.fg("dim", " No files changed"), width),
      ];
    }

    const height = this.props.height;
    let startIdx = 0;
    if (this.props.selectedIndex >= height)
      startIdx = this.props.selectedIndex - height + 1;

    const rows: string[] = [];
    for (let i = 0; i < height && startIdx + i < this.props.files.length; i++) {
      const idx = startIdx + i;
      const file = this.props.files[idx];
      const isSelected = idx === this.props.selectedIndex;
      const row = new FileChangeRow({
        file,
        isSelected,
        theme: this.props.theme,
      });
      rows.push(row.render(width)[0]);
    }

    return rows;
  }
}
