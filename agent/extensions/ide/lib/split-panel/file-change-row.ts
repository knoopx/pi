import type { Component } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { applySelectionBackground, truncateAnsi } from "../text-utils";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { hexColor } from "./utils";
import {
  getFileIcon,
  getFileStatusIcon,
  getFileIconColor,
} from "../file-icons";
import { formatFileStats } from "./stats";

interface FileChangeRowProps {
  file: {
    status: string;
    path: string;
    insertions?: number;
    deletions?: number;
  };
  isSelected: boolean;
  theme: Theme;
}


export class FileChangeRow implements Component {
  constructor(private readonly props: FileChangeRowProps) {}

  render(width: number): string[] {
    return [this.renderLine(width)];
  }

  invalidate(): void {}
  dispose(): void {}

  private renderLine(width: number): string {
    const { file, isSelected, theme } = this.props;

    const statusIcon = getFileStatusIcon(file.status);
    const fileIcon = getFileIcon(file.path);
    const iconHex = getFileIconColor(file.path);
    const coloredFileIcon =
      iconHex !== null && /^#[0-9a-f]{6}$/i.test(iconHex)
        ? hexColor(iconHex, fileIcon)
        : fileIcon;

    const statusColor: "toolDiffAdded" | "toolDiffRemoved" | "warning" =
      file.status === "A"
        ? "toolDiffAdded"
        : file.status === "D"
          ? "toolDiffRemoved"
          : "warning";

    const styledPath = theme.fg(statusColor, file.path);
    const stats = formatFileStats(file.insertions, file.deletions);
    const statsCount = stats.text ? stats.text.replace(/[+\-] /, "") : "";
    const statusCountStr =
      statsCount && parseInt(statsCount) > 0
        ? theme.fg(statusColor, `${statusIcon} ${statsCount}`)
        : theme.fg(statusColor, ` ${statusIcon}`);

    const prefixWidth = visibleWidth(coloredFileIcon + " ");
    const rightWidth = visibleWidth(statusCountStr);
    const availablePathWidth = Math.max(
      1,
      width - prefixWidth - rightWidth - 1,
    );

    // Use width-aware truncation instead of raw .slice() to avoid cutting ANSI codes
    const truncatedPath = truncateAnsi(styledPath, availablePathWidth);
    const pathVisibleWidth = visibleWidth(truncatedPath);
    const padding = " ".repeat(
      Math.max(0, availablePathWidth - pathVisibleWidth),
    );
    const rawLine = `${coloredFileIcon} ${truncatedPath}${padding}${statusCountStr}`;

    if (isSelected) {
      return applySelectionBackground(rawLine, width, theme);
    }
    return truncateToWidth(rawLine, width, "", true);
  }
}
