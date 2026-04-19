import type { Theme } from "@mariozechner/pi-coding-agent";
import type { GraphLayout, Edge } from "../graph";
import { renderGraphRow } from "../graph";
import { formatChangeRow, visibleLength } from "../changes-formatting";
import { ensureWidth, truncateAnsi } from "../text-utils";

export interface ChangeRowFlags {
  isCursor: boolean;
  isMarked: boolean;
  isFocused: boolean;
  isWorkingCopy: boolean;
  isMoving: boolean;
}

interface ChangeRowProps {
  change: {
    changeId: string;
    immutable: boolean;
    description: string;
    author?: string;
  };
  idx: number;
  width: number;
  flags: ChangeRowFlags;
  bookmarks: string[];
  theme: Theme;
  layout: GraphLayout | null;
}


export class ChangeRow {
  private readonly props: Omit<ChangeRowProps, "width">;

  constructor(props: Omit<ChangeRowProps, "width">) {
    this.props = props;
  }

  render(width: number): string[] {
    return [this.renderLine(width)];
  }

  private renderLine(width: number): string {
    const graph = renderGraphPrefix({
      layout: this.props.layout,
      changeId: this.props.change.changeId,
      idx: this.props.idx,
      isWorkingCopy: this.props.flags.isWorkingCopy,
      theme: this.props.theme,
      immutable: this.props.change.immutable,
    });

    const { leftText, rightText } = formatChangeRow(this.props.theme, {
      isImmutable: this.props.change.immutable,
      isSelected: this.props.flags.isMarked,
      isFocused: this.props.flags.isFocused,
      isMoving: this.props.flags.isMoving,
      bookmarks: this.props.bookmarks,
      description: this.props.change.description,
    });

    return assembleChangeRow({
      graphPrefix: graph,
      leftText,
      rightText,
      width,
      theme: this.props.theme,
      isFocused: this.props.flags.isFocused,
      isMarked: this.props.flags.isMarked,
      padLeft: true,
    });
  }
}


function renderGraphPrefix(options: {
  layout: GraphLayout | null;
  changeId: string;
  idx: number;
  isWorkingCopy: boolean;
  theme: Theme;
  immutable: boolean;
}): string {
  const { layout, changeId, idx, isWorkingCopy, theme, immutable } = options;
  if (!layout) return "";

  const pos = layout.positions.get(changeId);
  if (!pos) return "";

  const edges = layout.edges[idx] ?? ([] as Edge[]);
  const graphLine = renderGraphRow({
    edges,
    commitX: pos.x,
    isWorkingCopy,
    isEmpty: immutable,
    maxX: layout.maxX,
  });

  if (isWorkingCopy) return theme.fg("accent", graphLine + " ");
  if (immutable) return theme.fg("dim", graphLine + " ");
  return graphLine + " ";
}


function assembleChangeRow(options: {
  graphPrefix: string;
  leftText: string;
  rightText: string;
  width: number;
  theme: Theme;
  isFocused: boolean;
  isMarked: boolean;
  padLeft?: boolean;
}): string {
  const { graphPrefix, leftText, rightText, width, theme, isFocused, isMarked, padLeft = false } = options;

  const graphWidth = visibleLength(graphPrefix);
  const rightLen = visibleLength(rightText);
  const availableLeftWidth = Math.max(1, width - rightLen - graphWidth);

  const leftTruncated = truncateAnsi(leftText, availableLeftWidth);
  const leftPadded = padLeft
    ? ensureWidth(leftTruncated, availableLeftWidth)
    : leftTruncated;

  const line = graphPrefix + leftPadded + rightText;

  if (isFocused || isMarked) {
    const visLen = visibleLength(line);
    const cleanLine = line.replace(/\x1b\[0m/g, "");
    return theme.bg(
      "selectedBg",
      cleanLine + " ".repeat(Math.max(0, width - visLen)),
    );
  }

  return ensureWidth(line, width);
}
