import type { Theme } from "@earendil-works/pi-coding-agent";
import { FileChangeRow } from "./file-change-row";
import { renderListPane } from "./list-pane-renderer";

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
    return renderListPane({
      items: this.props.files,
      selectedIndex: this.props.selectedIndex,
      height: this.props.height,
      width,
      theme: this.props.theme,
      emptyMessage: " No files changed",
      createRow: (file, idx) => {
        const isSelected = idx === this.props.selectedIndex;
        return new FileChangeRow({
          file,
          isSelected,
          theme: this.props.theme,
        });
      },
    });
  }
}
