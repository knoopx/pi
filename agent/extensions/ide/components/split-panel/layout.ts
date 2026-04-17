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

export interface SplitPanelDimensions {
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

export type { SplitPanelConfig, SplitPanelRows };

/**
 * Calculate dimensions for a split panel overlay
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
