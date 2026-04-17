import type { Theme } from "@mariozechner/pi-coding-agent";
import { pad, ensureWidth } from "../text-utils";
import { BOX } from "../ui/frame";
import type {
  SplitPanelConfig,
  SplitPanelDimensions,
  SplitPanelRows,
} from "./layout";

/**
 * Create a border function for a given theme and color
 */
export function createBorderFn(
  theme: Theme,
): (color: "border" | "borderAccent", s: string) => string {
  return (color, s) => theme.fg(color, s);
}

/**
 * Get border color based on focus state
 */
export function getBorderColor(
  focus: boolean | undefined,
): "border" | "borderAccent" {
  return focus ? "borderAccent" : "border";
}

/**
 * Render a row in a split panel layout
 */
export function renderPanelRow(
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
export function getPanelBorderConfig(
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
