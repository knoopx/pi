import type { Theme } from "@mariozechner/pi-coding-agent";
import stringWidth from "string-width";
import { pad, ensureWidth, truncateAnsi, renderListRow } from "./text-utils";
import { getChangeIcon } from "./change-utils";
import { getFileStatusIcon, getFileIcon, getFileIconColor } from "./file-icons";
import { hexColor } from "./style-utils";
import { BOX } from "./ui/frame";
import { highlightCodeLines } from "./file-preview";

/**
 * Create a border function for a given theme and color
 */
function createBorderFn(
  theme: Theme,
): (color: "border" | "borderAccent", s: string) => string {
  return (color, s) => theme.fg(color, s);
}

/**
 * Get border color based on focus state
 */
function getBorderColor(focus: boolean | undefined): "border" | "borderAccent" {
  return focus ? "borderAccent" : "border";
}

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
  const rightW = width - leftW - 3; // 3 for border chars

  const overlayHeight = terminalRows;
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
 * Create a border row renderer for split panels
 */
function createBorderRowRenderer(theme: Theme) {
  const border = createBorderFn(theme);
  return function renderBorderRow(
    leftColor: "border" | "borderAccent",
    leftStart: string,
    leftContent: string,
    middle: string,
    rightContent: string,
    rightColor: "border" | "borderAccent",
    rightEnd: string,
  ): string {
    return (
      border(leftColor, leftStart) +
      border(leftColor, leftContent) +
      border("border", middle) +
      border(rightColor, rightContent) +
      border(rightColor, rightEnd)
    );
  };
}

/**
 * Create a row renderer with focus-based border colors
 */
function createFocusedRowRenderer(
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
) {
  const renderRow = createBorderRowRenderer(theme);
  const lb = getBorderColor(leftFocus);
  const rb = getBorderColor(rightFocus);
  return (
    leftStart: string,
    leftContent: string,
    middle: string,
    rightContent: string,
    rightEnd: string,
  ) =>
    renderRow(lb, leftStart, leftContent, middle, rightContent, rb, rightEnd);
}

/**
 * Render top border row
 */
function renderTopBorder(
  leftW: number,
  rightW: number,
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
): string {
  const renderRow = createFocusedRowRenderer(leftFocus, rightFocus, theme);
  return renderRow(
    BOX.topLeft,
    BOX.horizontal.repeat(leftW),
    BOX.teeDown,
    BOX.horizontal.repeat(rightW),
    BOX.topRight,
  );
}

/**
 * Render title row
 */
function renderTitleRow(
  leftTitle: string,
  rightTitle: string,
  leftW: number,
  rightW: number,
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
): string {
  const renderRow = createFocusedRowRenderer(leftFocus, rightFocus, theme);
  return renderRow(
    BOX.vertical,
    theme.fg("accent", pad(leftTitle, leftW)),
    BOX.vertical,
    theme.fg("accent", pad(rightTitle, rightW)),
    BOX.vertical,
  );
}

/**
 * Render separator row after title
 */
function renderSeparatorRow(
  leftW: number,
  rightW: number,
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
): string {
  const renderRow = createFocusedRowRenderer(leftFocus, rightFocus, theme);
  return renderRow(
    BOX.teeLeft,
    BOX.horizontal.repeat(leftW),
    BOX.cross,
    BOX.horizontal.repeat(rightW),
    BOX.teeRight,
  );
}

/**
 * Render bottom border with help text
 */
function renderBottomBorder(
  leftW: number,
  rightW: number,
  helpText: string,
  leftFocus: boolean,
  theme: Theme,
): string[] {
  const border = createBorderFn(theme);
  const lb = getBorderColor(leftFocus);

  const separator =
    border(lb, BOX.teeLeft) +
    border(lb, BOX.horizontal.repeat(leftW)) +
    border("border", BOX.teeUp) +
    border("border", BOX.horizontal.repeat(rightW)) +
    border("border", BOX.teeRight);

  const helpRow =
    border("border", BOX.vertical) +
    theme.fg("dim", pad(` ${helpText}`, leftW + rightW + 1)) +
    border("border", BOX.vertical);

  const bottomRow =
    border("border", BOX.bottomLeft) +
    border("border", BOX.horizontal.repeat(leftW + rightW + 1)) +
    border("border", BOX.bottomRight);

  return [separator, helpRow, bottomRow];
}

/**
 * Get panel border configuration
 */
function getPanelBorderConfig(
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
) {
  const lb: "border" | "borderAccent" = leftFocus ? "borderAccent" : "border";
  const rb: "border" | "borderAccent" = rightFocus ? "borderAccent" : "border";
  const border = (color: "border" | "borderAccent", s: string) =>
    theme.fg(color, s);
  return { lb, rb, border };
}

/**
 * Render split right panel content
 */
function renderSplitRightPanel(
  leftRows: string[],
  rightTopRows: string[],
  rightBottomRows: string[],
  leftW: number,
  rightW: number,
  rightTopH: number,
  rightBottomH: number,
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  rightBottomTitle: string,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  const { lb, rb, border } = getPanelBorderConfig(leftFocus, rightFocus, theme);

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
      border(rb, BOX.teeLeft) +
      border(rb, BOX.horizontal.repeat(rightW)) +
      border(rb, BOX.teeRight),
  );

  // Right bottom title
  lines.push(
    border(lb, BOX.vertical) +
      ensureWidth(leftRows[rightTopH + 1] || "", leftW) +
      border(rb, BOX.vertical) +
      theme.fg("accent", pad(rightBottomTitle, rightW)) +
      border(rb, BOX.vertical),
  );

  lines.push(
    border(lb, BOX.vertical) +
      ensureWidth(leftRows[rightTopH + 2] || "", leftW) +
      border(rb, BOX.teeLeft) +
      border(rb, BOX.horizontal.repeat(rightW)) +
      border(rb, BOX.teeRight),
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
        rb,
        border,
      ),
    );
  }

  return lines;
}

/**
 * Render simple two-column panel content
 */
function renderSimplePanel(
  leftRows: string[],
  rightRows: string[],
  leftW: number,
  rightW: number,
  contentH: number,
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  const { lb, rb, border } = getPanelBorderConfig(leftFocus, rightFocus, theme);

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

  return lines;
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

  lines.push(
    renderTopBorder(leftW, rightW, config.leftFocus, config.rightFocus, theme),
  );

  lines.push(
    renderTitleRow(
      config.leftTitle,
      config.rightTopTitle ?? config.rightTitle,
      leftW,
      rightW,
      config.leftFocus,
      config.rightFocus,
      theme,
    ),
  );

  lines.push(
    renderSeparatorRow(
      leftW,
      rightW,
      config.leftFocus,
      config.rightFocus,
      theme,
    ),
  );

  if (config.rightSplit && dims.rightTopH && dims.rightBottomH) {
    const { rightTopH } = dims;
    const { rightBottomH } = dims;
    const leftRows = rows.left;
    const rightTopRows = rows.rightTop ?? [];
    const rightBottomRows = rows.rightBottom ?? [];

    const panelRows = renderSplitRightPanel(
      leftRows,
      rightTopRows,
      rightBottomRows,
      leftW,
      rightW,
      rightTopH,
      rightBottomH,
      config.leftFocus,
      config.rightFocus,
      config.rightBottomTitle ?? " Preview",
      theme,
    );
    lines.push(...panelRows);
  } else {
    const leftRows = rows.left;
    const rightRows = rows.right ?? [];

    const panelRows = renderSimplePanel(
      leftRows,
      rightRows,
      leftW,
      rightW,
      contentH,
      config.leftFocus,
      config.rightFocus,
      theme,
    );
    lines.push(...panelRows);
  }

  const bottomRows = renderBottomBorder(
    leftW,
    rightW,
    config.helpText,
    config.leftFocus,
    theme,
  );
  lines.push(...bottomRows);

  return lines;
}

/**
 * Render source code rows with line highlighting
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
    const isHighlighted =
      highlightRange &&
      lineNum >= highlightRange.start &&
      lineNum <= highlightRange.end;

    const styledLine = highlightCodeLines(
      visible[i],
      theme,
      isHighlighted ? "accent" : undefined,
    );
    const content = ` ${styledLine}`;
    const truncated = truncateAnsi(content, width - 1);
    const final = ensureWidth(truncated, width);
    rows.push(final);
  }

  return rows;
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
    const content = ` ${styledLine}`;
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
 * Format file stats for display (net changes: insertions minus deletions)
 */
function formatFileStats(
  insertions: number | undefined,
  deletions: number | undefined,
): { text: string; isPositive: boolean } {
  const ins = insertions ?? 0;
  const del = deletions ?? 0;
  const net = ins - del;
  if (net === 0) return { text: "", isPositive: true };
  const sign = net > 0 ? "+" : "-";
  return { text: `${sign} ${Math.abs(net)}`, isPositive: net > 0 };
}

/**
 * Render file change rows with status colors
 */
export function renderFileChangeRows(
  files: {
    status: string;
    path: string;
    insertions?: number;
    deletions?: number;
  }[],
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
  if (fileIndex >= visibleCount) startIdx = fileIndex - visibleCount + 1;

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

    const _styledStatus = theme.fg(statusColor, statusIcon);
    const _styledFileIcon = fileIconColor
      ? hexColor(fileIconColor, fileIcon)
      : theme.fg(statusColor, fileIcon);
    const styledPath = theme.fg(statusColor, file.path);

    const stats = formatFileStats(file.insertions, file.deletions);
    const statsColor = stats.isPositive ? "toolDiffAdded" : "toolDiffRemoved";
    const styledStats = stats.text
      ? theme.fg(statsColor, ` ${stats.text}`)
      : "";

    const prefix = ` ${statusIcon} ${fileIcon} `; // status + file icon + spaces
    const prefixWidth = stringWidth(prefix);
    const statsWidth = styledStats ? stringWidth(styledStats) : 0;
    const rightPadding = 1; // one char padding from right edge
    const availablePathWidth = Math.max(
      1,
      width - prefixWidth - statsWidth - rightPadding,
    );

    const truncatedPath = truncateAnsi(styledPath, availablePathWidth);
    const pathWidth = stringWidth(truncatedPath);
    const paddingSpaces = Math.max(0, availablePathWidth - pathWidth);
    const padding = " ".repeat(paddingSpaces);

    const rightPaddingStr = " ".repeat(rightPadding);
    const line = `${prefix}${truncatedPath}${padding}${styledStats}${rightPaddingStr}`;
    const padded = ensureWidth(line, width);

    if (isSelected) {
      const statsPlain = stats.text ? ` ${stats.text}` : "";
      const plainPrefix = ` ${statusIcon} ${fileIcon} `;
      const plainPath = truncateAnsi(file.path, availablePathWidth);
      const plainPathWidth = stringWidth(plainPath);
      const plainPaddingSpaces = Math.max(
        0,
        availablePathWidth - plainPathWidth,
      );
      const plainPadding = " ".repeat(plainPaddingSpaces);
      const plainText = `${plainPrefix}${plainPath}${plainPadding}${statsPlain}${rightPaddingStr}`;
      const paddedPlain = ensureWidth(plainText, width);
      const styled = theme.fg("accent", theme.bold(paddedPlain));
      rows.push(theme.bg("selectedBg", styled));
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
  }
  return Math.max(0, currentScroll - scrollAmount);
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
  if (selectedIndex >= visibleCount)
    startIdx = selectedIndex - visibleCount + 1;

  for (let i = 0; i < visibleCount && startIdx + i < changes.length; i++) {
    const idx = startIdx + i;
    const change = changes[idx];
    const isSelected = idx === selectedIndex && isFocused;
    const isCurrent = idx === 0;

    const icon = getChangeIcon(isCurrent, change.empty);
    const shortId = change.changeId.slice(0, 8);
    const desc = truncateAnsi(change.description, width - 13);
    const text = ` ${icon} ${shortId} ${desc}`;

    rows.push(renderListRow(text, width, isSelected, isCurrent, theme));
  }

  return rows;
}
