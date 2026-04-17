import type { Theme } from "@mariozechner/pi-coding-agent";
import type { GraphLayout, Edge } from "./graph";
import { renderGraphRow } from "./graph";
import { truncateAnsi, ensureWidth } from "./text-utils";
import { visibleLength } from "./changes/formatting";

/** Render the graph prefix for a change row. */
export function renderGraphPrefix(
  layout: GraphLayout | null,
  changeId: string,
  idx: number,
  isWorkingCopy: boolean,
  theme: Theme,
  immutable: boolean,
): string {
  if (!layout) return "";

  const pos = layout.positions.get(changeId);
  if (!pos) return "";

  const edges = layout.edges[idx] ?? ([] as Edge[]);
  const graphLine = renderGraphRow(
    edges,
    pos.x,
    isWorkingCopy,
    immutable,
    layout.maxX,
  );

  if (isWorkingCopy) return theme.fg("accent", graphLine + " ");
  if (immutable) return theme.fg("dim", graphLine + " ");
  return graphLine + " ";
}

/** Assemble a change row line with proper width handling. */
export function assembleChangeRow(
  graphPrefix: string,
  leftText: string,
  rightText: string,
  width: number,
  options: {
    theme?: Theme;
    isFocused: boolean;
    isMarked: boolean;
    padLeft?: boolean;
  },
): string {
  const { theme, isFocused, isMarked, padLeft = false } = options;

  const graphWidth = visibleLength(graphPrefix);
  const rightLen = visibleLength(rightText);
  const availableLeftWidth = Math.max(1, width - rightLen - graphWidth);

  const leftTruncated = truncateAnsi(leftText, availableLeftWidth);
  const leftPadded = padLeft
    ? ensureWidth(leftTruncated, availableLeftWidth)
    : leftTruncated;

  let line = graphPrefix + leftPadded + rightText;

  if (isFocused || isMarked) {
    const visLen = visibleLength(line);
    const cleanLine = line.replace(/\x1b\[0m/g, "");
    return theme!.bg(
      "selectedBg",
      cleanLine + " ".repeat(Math.max(0, width - visLen)),
    );
  }

  return ensureWidth(line, width);
}
