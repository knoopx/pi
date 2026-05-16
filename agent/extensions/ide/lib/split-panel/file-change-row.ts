import type { Component } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { applySelectionBackground } from "../formatting/text";
import { truncateAnsi } from "../../../../shared/format/ansi-text";
import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
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
    conflicted?: boolean;
  };
  isSelected: boolean;
  theme: Theme;
}

function fileStatusColor(
  status: string,
): "toolDiffAdded" | "toolDiffRemoved" | "warning" {
  if (status === "A") return "toolDiffAdded";
  if (status === "D") return "toolDiffRemoved";
  return "warning";
}

function coloredIcon(
  path: string,
  isConflicted: boolean,
  theme: Theme,
): string {
  if (isConflicted) return theme.fg("warning", "⚠");
  const icon = getFileIcon(path);
  const hex = getFileIconColor(path);
  if (hex !== null && /^#[0-9a-f]{6}$/i.test(hex)) {
    return hexColor(hex, icon);
  }
  return icon;
}

function statusCountString(
  statusIcon: string,
  insertions: number | undefined,
  deletions: number | undefined,
  statusColor: ThemeColor,
  theme: Theme,
): string {
  const stats = formatFileStats(insertions, deletions);
  const count = stats.text ? stats.text.replace(/[+\-] /, "") : "";
  if (count && parseInt(count) > 0) {
    return theme.fg(statusColor, `${statusIcon} ${count}`);
  }
  return theme.fg(statusColor, ` ${statusIcon}`);
}

export class FileChangeRow implements Component {
  constructor(private readonly props: FileChangeRowProps) {}

  render(width: number): string[] {
    return [this.renderLine(width)];
  }

  private renderLine(width: number): string {
    const { file, isSelected, theme } = this.props;
    const statusIcon = getFileStatusIcon(file.status);
    const isConflicted = file.conflicted === true;
    const coloredFileIcon = coloredIcon(file.path, isConflicted, theme);
    const statusColor = fileStatusColor(file.status);
    const styledPath = theme.fg(statusColor, file.path);
    const statusCountStr = statusCountString(
      statusIcon,
      file.insertions,
      file.deletions,
      statusColor,
      theme,
    );
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

  invalidate(): void {}
}
