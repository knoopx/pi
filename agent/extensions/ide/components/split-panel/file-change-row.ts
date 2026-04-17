import type { Component } from "@mariozechner/pi-tui";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { truncateAnsi, ensureWidth } from "../text-utils";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { hexColor } from "./utils";
import {
  getFileStatusIcon,
  getFileIcon,
  getFileIconColor,
} from "../file-icons";
import { formatFileStats } from "./stats";

export interface FileChangeRowProps {
  file: {
    status: string;
    path: string;
    insertions?: number;
    deletions?: number;
  };
  isSelected: boolean;
  theme: Theme;
}

/** A single file change row rendered as a pi-tui Component. */
export class FileChangeRow implements Component {
  private cachedWidth = 0;
  private cachedLines: string[] | null = null;

  constructor(private readonly props: FileChangeRowProps) {}

  render(width: number): string[] {
    if (width === this.cachedWidth && this.cachedLines) return this.cachedLines;
    this.cachedWidth = width;
    this.cachedLines = null;

    const line = this.renderLine(width);
    this.cachedLines = [line];
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = 0;
  }

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
    let rawLine = `${coloredFileIcon} ${truncatedPath}${padding}${statusCountStr}`;

    if (isSelected) {
      // Pad content to full width then apply bg so spaces also get background
      const visibleLen = visibleWidth(rawLine);
      const pad = Math.max(0, width - visibleLen);
      return theme.bg("selectedBg", rawLine + " ".repeat(pad));
    }
    return truncateToWidth(rawLine, width, "", true);
  }
}

/** Empty row rendered when the list is empty. */
export class EmptyFileChangeRow implements Component {
  constructor(
    private readonly message: string,
    private readonly theme: Theme,
  ) {}

  render(width: number): string[] {
    return [this.renderLine(width)];
  }

  invalidate(): void {}
  dispose(): void {}

  private renderLine(width: number): string {
    const text = this.theme.fg("dim", ` ${this.message}`);
    return truncateToWidth(text, width, "", true);
  }
}
