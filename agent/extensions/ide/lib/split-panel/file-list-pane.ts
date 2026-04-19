import type { Theme } from "@mariozechner/pi-coding-agent";
import { FileChangeRow } from "./file-change-row";
import { ensureWidth, getVisibleItems } from "../text-utils";

interface FileListPaneProps {
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


export class FileListPane {
  constructor(private readonly props: FileListPaneProps) {}

  render(width: number): string[] {
    if (this.props.files.length === 0) {
      return [
        ensureWidth(this.props.theme.fg("dim", " No files changed"), width),
      ];
    }

    const visibleItems = getVisibleItems(
      this.props.files,
      this.props.selectedIndex,
      this.props.height,
    );

    const rows: string[] = [];
    for (const { item: file, index: idx } of visibleItems) {
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

  invalidate(): void {}
  dispose(): void {}
}
