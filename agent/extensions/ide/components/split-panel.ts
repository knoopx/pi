import type { Theme } from "@mariozechner/pi-coding-agent";
import { pad, ensureWidth, truncateAnsi } from "./text-utils";
import { getChangeIcon } from "./change-utils";
import { getFileStatusIcon, getFileIcon, getFileIconColor } from "./file-icons";
import { hexColor } from "./style-utils";
import { BOX } from "./ui/frame";

/**
 * Render a row in a split panel layout
 */
function renderPanelRow(
  leftContent: string,
  rightContent: string,
  leftW: number,
  rightW: number,
  lb: "border" | "borderAccent",
  rb: "border" | "borderAccent",
  border: (color: "border" | "borderAccent", s: string) => string,
): string {
  return (
    border(lb, BOX.vertical) +
    ensureWidth(leftContent, leftW) +
    border("border", BOX.vertical) +
    ensureWidth(rightContent, rightW) +
    border(rb, BOX.vertical)
  );
}

interface SplitPanelConfig {
  leftTitle: string;
  rightTitle: string;
  rightTopTitle?: string;
  rightBottomTitle?: string;
  helpText: string;
  leftFocus: boolean;
  rightFocus?: boolean;
  /** Split ratio for left panel (0-1), default 0.35 */
  leftRatio?: number;
  /** Whether right panel is split vertically */
  rightSplit?: boolean;
  /** Ratio of top section in right split (0-1), default 0.3 */
  rightTopRatio?: number;
}

interface SplitPanelDimensions {
  width: number;
  height: number;
  leftW: number;
  rightW: number;
  contentH: number;
  /** Height of right top section (if split) */
  rightTopH?: number;
  /** Height of right bottom section (if split) */
  rightBottomH?: number;
}

interface SplitPanelRows {
  left: string[];
  right?: string[];
  rightTop?: string[];
  rightBottom?: string[];
}

/**
 * Calculate dimensions for a split panel overlay
 * @param terminalRows - Terminal rows (tui.terminal.rows)
 * @param width - Overlay width passed to render()
 * @param config - Panel configuration
 */
export function calculateDimensions(
  terminalRows: number,
  width: number,
  config: SplitPanelConfig,
): SplitPanelDimensions {
  const leftRatio = config.leftRatio ?? 0.35;
  const leftW = Math.floor(width * leftRatio);
  const rightW = width - leftW - 3; // 3 for border chars │ │ │

  // Calculate overlay height (100% of terminal)
  const overlayHeight = terminalRows;
  // Content height = overlay height - borders (top, title, separator, help, bottom = 5 lines min)
  // For split right: add 3 more lines for separator
  const borderLines = config.rightSplit ? 8 : 5;
  const contentH = overlayHeight - borderLines;

  const result: SplitPanelDimensions = {
    width,
    height: overlayHeight,
    leftW,
    rightW,
    contentH,
  };

  if (config.rightSplit) {
    const rightTopRatio = config.rightTopRatio ?? 0.3;
    result.rightTopH = Math.min(
      Math.max(3, Math.floor(contentH * rightTopRatio)),
      Math.floor(contentH * 0.4),
    );
    result.rightBottomH = contentH - result.rightTopH - 3; // 3 for separator lines
  }

  return result;
}

/**
 * Render a split panel layout
 */
export function renderSplitPanel(
  theme: Theme,
  config: SplitPanelConfig,
  dims: SplitPanelDimensions,
  rows: SplitPanelRows,
): string[] {
  const lines: string[] = [];
  const { leftW, rightW, contentH } = dims;

  const lb = config.leftFocus ? "borderAccent" : "border";
  const rb = config.rightFocus ? "borderAccent" : "border";
  const border = (color: "border" | "borderAccent", s: string) =>
    theme.fg(color, s);

  // Top border
  lines.push(
    border(lb, BOX.topLeft) +
      border(lb, BOX.horizontal.repeat(leftW)) +
      border("border", BOX.teeDown) +
      border(rb, BOX.horizontal.repeat(rightW)) +
      border(rb, BOX.topRight),
  );

  // Title row
  lines.push(
    border(lb, BOX.vertical) +
      theme.fg("accent", pad(config.leftTitle, leftW)) +
      border("border", BOX.vertical) +
      theme.fg(
        "accent",
        pad(config.rightTopTitle ?? config.rightTitle, rightW),
      ) +
      border(rb, BOX.vertical),
  );

  // Separator after title
  lines.push(
    border(lb, BOX.teeLeft) +
      border(lb, BOX.horizontal.repeat(leftW)) +
      border("border", BOX.cross) +
      border(rb, BOX.horizontal.repeat(rightW)) +
      border(rb, BOX.teeRight),
  );

  if (config.rightSplit && dims.rightTopH && dims.rightBottomH) {
    // Split right panel layout
    const rightTopH = dims.rightTopH;
    const rightBottomH = dims.rightBottomH;
    const leftRows = rows.left;
    const rightTopRows = rows.rightTop ?? [];
    const rightBottomRows = rows.rightBottom ?? [];

    // Right top section
    for (let i = 0; i < rightTopH; i++) {
      lines.push(
        renderPanelRow(
          leftRows[i] || pad("", leftW),
          rightTopRows[i] || pad("", rightW),
          leftW,
          rightW,
          lb,
          rb,
          border,
        ),
      );
    }

    // Separator between right top and bottom
    lines.push(
      border(lb, BOX.vertical) +
        ensureWidth(leftRows[rightTopH] || "", leftW) +
        border("border", BOX.teeLeft) +
        border("border", BOX.horizontal.repeat(rightW)) +
        border("border", BOX.teeRight),
    );

    // Right bottom title
    lines.push(
      border(lb, BOX.vertical) +
        ensureWidth(leftRows[rightTopH + 1] || "", leftW) +
        border("border", BOX.vertical) +
        theme.fg("accent", pad(config.rightBottomTitle ?? " Preview", rightW)) +
        border("border", BOX.vertical),
    );

    lines.push(
      border(lb, BOX.vertical) +
        ensureWidth(leftRows[rightTopH + 2] || "", leftW) +
        border("border", BOX.teeLeft) +
        border("border", BOX.horizontal.repeat(rightW)) +
        border("border", BOX.teeRight),
    );

    // Right bottom section
    for (let i = 0; i < rightBottomH; i++) {
      const leftIdx = rightTopH + 3 + i;
      lines.push(
        renderPanelRow(
          leftRows[leftIdx] || pad("", leftW),
          rightBottomRows[i] || pad("", rightW),
          leftW,
          rightW,
          lb,
          "border",
          border,
        ),
      );
    }
  } else {
    // Simple two-column layout
    const leftRows = rows.left;
    const rightRows = rows.right ?? [];

    for (let i = 0; i < contentH; i++) {
      lines.push(
        renderPanelRow(
          leftRows[i] || pad("", leftW),
          rightRows[i] || pad("", rightW),
          leftW,
          rightW,
          lb,
          rb,
          border,
        ),
      );
    }
  }

  // Bottom border with help
  lines.push(
    border(lb, BOX.teeLeft) +
      border(lb, BOX.horizontal.repeat(leftW)) +
      border("border", BOX.teeUp) +
      border("border", BOX.horizontal.repeat(rightW)) +
      border("border", BOX.teeRight),
  );

  lines.push(
    border("border", BOX.vertical) +
      theme.fg("dim", pad(" " + config.helpText, leftW + rightW + 1)) +
      border("border", BOX.vertical),
  );

  lines.push(
    border("border", BOX.bottomLeft) +
      border("border", BOX.horizontal.repeat(leftW + rightW + 1)) +
      border("border", BOX.bottomRight),
  );

  return lines;
}

/**
 * Generate rows for diff content (preserves ANSI colors from jj)
 */
export function renderDiffRows(
  lines: string[],
  width: number,
  height: number,
  scroll: number,
  theme: Theme,
): string[] {
  const rows: string[] = [];

  if (lines.length === 0) {
    rows.push(theme.fg("dim", pad(" No content", width)));
    return rows;
  }

  const visible = lines.slice(scroll, scroll + height);

  const hunkDividerPattern = /^─+ line \d+ ─+$/;

  for (const line of visible) {
    // Expand tabs to prevent width miscalculation
    const expanded = expandTabs(line);
    const styledLine = hunkDividerPattern.test(expanded)
      ? theme.fg("muted", expanded)
      : expanded;
    const content = " " + styledLine;
    const truncated = truncateAnsi(content, width - 1);
    const final = ensureWidth(truncated, width);
    rows.push(final);
  }

  return rows;
}

/**
 * Replace tab characters with spaces (tabs cause width miscalculation)
 */
function expandTabs(text: string, tabWidth = 2): string {
  return text.replace(/\t/g, " ".repeat(tabWidth));
}

/**
 * Render file change rows with status colors
 */
export function renderFileChangeRows(
  files: { status: string; path: string }[],
  width: number,
  height: number,
  fileIndex: number,
  isFocused: boolean,
  theme: Theme,
  emptyMessage = " No files changed",
): string[] {
  const rows: string[] = [];

  if (files.length === 0) {
    rows.push(theme.fg("dim", pad(emptyMessage, width)));
    return rows;
  }

  const visibleCount = height;
  let startIdx = 0;
  if (fileIndex >= visibleCount) {
    startIdx = fileIndex - visibleCount + 1;
  }

  const getStatusColor = (
    status: string,
  ): "toolDiffAdded" | "toolDiffRemoved" | "warning" => {
    if (status === "A") return "toolDiffAdded";
    if (status === "D") return "toolDiffRemoved";
    return "warning";
  };

  for (let i = 0; i < visibleCount && startIdx + i < files.length; i++) {
    const idx = startIdx + i;
    const file = files[idx];
    const isSelected = idx === fileIndex && isFocused;
    const statusIcon = getFileStatusIcon(file.status);
    const fileIcon = getFileIcon(file.path);
    const fileIconColor = getFileIconColor(file.path);
    const statusColor = getStatusColor(file.status);

    const styledStatus = theme.fg(statusColor, statusIcon);
    const styledFileIcon = fileIconColor
      ? hexColor(fileIconColor, fileIcon)
      : theme.fg(statusColor, fileIcon);
    const styledPath = theme.fg(statusColor, file.path);

    const line = ` ${styledStatus} ${styledFileIcon} ${styledPath}`;
    const truncated = truncateAnsi(line, width);
    const padded = ensureWidth(truncated, width);

    if (isSelected) {
      const plainText = ` ${statusIcon} ${fileIcon} ${file.path}`;
      const truncatedPlain = truncateAnsi(plainText, width);
      const paddedPlain = pad(truncatedPlain, width);
      rows.push(theme.fg("accent", theme.bold(paddedPlain)));
    } else {
      rows.push(padded);
    }
  }

  return rows;
}

/**
 * Render change/commit rows with selection and icons
 */

function handlePageScroll(
  direction: "up" | "down",
  currentScroll: number,
  contentLength: number,
  viewportHeight: number,
  scrollAmount = 10,
): number {
  if (direction === "down") {
    const maxScroll = Math.max(0, contentLength - viewportHeight);
    return Math.min(maxScroll, currentScroll + scrollAmount);
  } else {
    return Math.max(0, currentScroll - scrollAmount);
  }
}

/**
 * Calculate diff scroll for page up/down
 */
export function calculateDiffScroll(
  direction: "up" | "down",
  currentScroll: number,
  contentLength: number,
  terminalRows: number,
  cachedWidth: number,
): number {
  const dims = calculateDimensions(terminalRows, cachedWidth || 200, {
    leftTitle: "",
    rightTitle: "",
    helpText: "",
    leftFocus: true,
    rightSplit: true,
  });
  return handlePageScroll(
    direction,
    currentScroll,
    contentLength,
    dims.rightBottomH ?? 10,
  );
}

export function renderChangeRows(
  changes: {
    changeId: string;
    description: string;
    empty: boolean;
  }[],
  width: number,
  height: number,
  selectedIndex: number,
  isFocused: boolean,
  theme: Theme,
  emptyMessage = " No changes",
): string[] {
  const rows: string[] = [];

  if (changes.length === 0) {
    rows.push(theme.fg("dim", pad(emptyMessage, width)));
    return rows;
  }

  const visibleCount = height;
  let startIdx = 0;
  if (selectedIndex >= visibleCount) {
    startIdx = selectedIndex - visibleCount + 1;
  }

  for (let i = 0; i < visibleCount && startIdx + i < changes.length; i++) {
    const idx = startIdx + i;
    const change = changes[idx];
    const isSelected = idx === selectedIndex && isFocused;
    const isCurrent = idx === 0;

    const icon = getChangeIcon(isCurrent, change.empty);
    const shortId = change.changeId.slice(0, 8);
    const desc = truncateAnsi(change.description, width - 13);
    const text = ` ${icon} ${shortId} ${desc}`;
    const truncated = truncateAnsi(text, width);
    const final = ensureWidth(truncated, width);

    if (isSelected) {
      rows.push(theme.fg("accent", theme.bold(final)));
    } else if (isCurrent) {
      rows.push(theme.fg("warning", final));
    } else {
      rows.push(final);
    }
  }

  return rows;
}

/**
 * Generate rows for source code with line numbers
 */
export function renderSourceRows(
  lines: string[],
  width: number,
  height: number,
  scroll: number,
  theme: Theme,
  highlightRange?: { start: number; end: number },
): string[] {
  const rows: string[] = [];

  if (lines.length === 0) {
    rows.push(theme.fg("dim", pad(" No preview available", width)));
    return rows;
  }

  const visible = lines.slice(scroll, scroll + height);

  for (let i = 0; i < visible.length; i++) {
    const lineNum = scroll + i + 1;
    // Expand tabs to spaces to prevent width miscalculation
    const line = expandTabs(visible[i] || "");

    const isHighlighted =
      highlightRange &&
      lineNum >= highlightRange.start &&
      lineNum <= highlightRange.end;

    const lineNumStr = String(lineNum).padStart(4, " ");
    const lineNumStyled = isHighlighted
      ? theme.fg("accent", lineNumStr)
      : theme.fg("dim", lineNumStr);

    // Use ANSI-aware truncation to preserve colors from bat
    const content = " " + truncateAnsi(line, width - 6);
    const fullLine = lineNumStyled + " " + content;
    rows.push(ensureWidth(fullLine, width));
  }

  return rows;
}
