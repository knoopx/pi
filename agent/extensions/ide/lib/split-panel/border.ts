import type { Theme } from "@mariozechner/pi-coding-agent";
import { pad, ensureWidth } from "../text-utils";
import { BOX } from "../ui/frame";
import type {
  SplitPanelConfig,
  SplitPanelDimensions,
  SplitPanelRows,
} from "./layout";

type BorderColor = "border" | "borderAccent";

interface PanelRowArgs {
  leftContent: string;
  rightContent: string;
  leftW: number;
  rightW: number;
  lb: BorderColor;
  rb: BorderColor;
  mb: BorderColor;
  border: (color: BorderColor, s: string) => string;
}

interface BorderRowArgs {
  leftColor: BorderColor;
  middleColor: BorderColor;
  rightColor: BorderColor;
  leftStart: string;
  leftContent: string;
  middle: string;
  rightContent: string;
  rightEnd: string;
  border: (color: BorderColor, s: string) => string;
}

interface FocusedRowArgs {
  leftStart: string;
  leftContent: string;
  middle: string;
  rightContent: string;
  rightEnd: string;
}

interface TopBorderArgs {
  leftW: number;
  rightW: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  theme: Theme;
}

interface TitleRowArgs {
  leftTitle: string;
  rightTitle: string;
  leftW: number;
  rightW: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  theme: Theme;
}

interface SeparatorRowArgs {
  leftW: number;
  rightW: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  theme: Theme;
}

interface BottomBorderArgs {
  leftW: number;
  rightW: number;
  helpText: string;
  leftFocus: boolean;
  rightFocus: boolean | undefined;
  theme: Theme;
}

interface SplitRightPanelArgs {
  leftRows: string[];
  rightTopRows: string[];
  rightBottomRows: string[];
  leftW: number;
  rightW: number;
  rightTopH: number;
  rightBottomH: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  rightBottomTitle: string;
  theme: Theme;
}

interface SimplePanelArgs {
  leftRows: string[];
  rightRows: string[];
  leftW: number;
  rightW: number;
  contentH: number;
  leftFocus: boolean | undefined;
  rightFocus: boolean | undefined;
  theme: Theme;
}

function createBorderFn(
  theme: Theme,
): (color: BorderColor, s: string) => string {
  return (color, s) => theme.fg(color, s);
}

function getBorderColor(focus: boolean | undefined): BorderColor {
  return focus ? "borderAccent" : "border";
}

function getCenterBorderColor(
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
): BorderColor {
  return leftFocus || rightFocus ? "borderAccent" : "border";
}

function renderPanelRow(args: PanelRowArgs): string {
  const { leftContent, rightContent, leftW, rightW, lb, rb, mb, border } = args;
  return (
    border(lb, BOX.vertical) +
    ensureWidth(leftContent, leftW) +
    border(mb, BOX.vertical) +
    ensureWidth(rightContent, rightW) +
    border(rb, BOX.vertical)
  );
}

function renderBorderRow(args: BorderRowArgs): string {
  const {
    leftColor,
    middleColor,
    rightColor,
    leftStart,
    leftContent,
    middle,
    rightContent,
    rightEnd,
    border,
  } = args;
  return (
    border(leftColor, leftStart) +
    border(leftColor, leftContent) +
    border(middleColor, middle) +
    border(rightColor, rightContent) +
    border(rightColor, rightEnd)
  );
}

function createFocusedRowRenderer(
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
): (args: FocusedRowArgs) => string {
  const border = createBorderFn(theme);
  const lb = getBorderColor(leftFocus);
  const mb = getCenterBorderColor(leftFocus, rightFocus);
  const rb = getBorderColor(rightFocus);

  return (args: FocusedRowArgs): string =>
    renderBorderRow({
      ...args,
      leftColor: lb,
      middleColor: mb,
      rightColor: rb,
      border,
    });
}

function renderTopBorder(args: TopBorderArgs): string {
  const { leftW, rightW, leftFocus, rightFocus, theme } = args;
  const renderRow = createFocusedRowRenderer(leftFocus, rightFocus, theme);
  return renderRow({
    leftStart: BOX.topLeft,
    leftContent: BOX.horizontal.repeat(leftW),
    middle: BOX.teeDown,
    rightContent: BOX.horizontal.repeat(rightW),
    rightEnd: BOX.topRight,
  });
}

function renderTitleRow(args: TitleRowArgs): string {
  const { leftTitle, rightTitle, leftW, rightW, leftFocus, rightFocus, theme } =
    args;
  const renderRow = createFocusedRowRenderer(leftFocus, rightFocus, theme);
  return renderRow({
    leftStart: BOX.vertical,
    leftContent: theme.fg("accent", pad(leftTitle, leftW)),
    middle: BOX.vertical,
    rightContent: theme.fg("accent", pad(rightTitle, rightW)),
    rightEnd: BOX.vertical,
  });
}

function renderSeparatorRow(args: SeparatorRowArgs): string {
  const { leftW, rightW, leftFocus, rightFocus, theme } = args;
  const renderRow = createFocusedRowRenderer(leftFocus, rightFocus, theme);
  return renderRow({
    leftStart: BOX.teeLeft,
    leftContent: BOX.horizontal.repeat(leftW),
    middle: BOX.cross,
    rightContent: BOX.horizontal.repeat(rightW),
    rightEnd: BOX.teeRight,
  });
}

function renderBottomBorder(args: BottomBorderArgs): string[] {
  const { leftW, rightW, helpText, leftFocus, rightFocus, theme } = args;
  const border = createBorderFn(theme);
  const lb = getBorderColor(leftFocus);
  const rb = getBorderColor(rightFocus);
  const separatorMb = getCenterBorderColor(leftFocus, rightFocus);

  const separator =
    border(lb, BOX.teeLeft) +
    border(lb, BOX.horizontal.repeat(leftW)) +
    border(separatorMb, BOX.teeUp) +
    border(rb, BOX.horizontal.repeat(rightW)) +
    border(rb, BOX.teeRight);

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

function getPanelBorderConfig(
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
) {
  const lb: BorderColor = leftFocus ? "borderAccent" : "border";
  const rb: BorderColor = rightFocus ? "borderAccent" : "border";
  const border = (color: BorderColor, s: string) => theme.fg(color, s);
  return { lb, rb, border };
}

function renderSplitRightPanel(args: SplitRightPanelArgs): string[] {
  const {
    leftRows,
    rightTopRows,
    rightBottomRows,
    leftW,
    rightW,
    rightTopH,
    rightBottomH,
    leftFocus,
    rightFocus,
    rightBottomTitle,
    theme,
  } = args;

  const { lb, rb, border } = getPanelBorderConfig(leftFocus, rightFocus, theme);
  const mb = getCenterBorderColor(leftFocus, rightFocus);
  const ctx = { leftW, rightW, lb, rb, mb, border, leftRows };

  return [
    ...renderRightTopSection(rightTopRows, rightTopH, ctx),
    renderSplitSeparator(rightTopH, ctx),
    renderBottomTitleLine({
      leftRows,
      idx: rightTopH + 1,
      rightBottomTitle,
      leftW,
      rightW,
      theme,
      lb,
      mb,
      rb,
    }),
    renderBottomSeparatorLine(leftRows, rightTopH + 2, ctx),
    ...renderRightBottomSection(rightBottomRows, rightBottomH, rightTopH, ctx),
  ];
}

function renderRightTopSection(
  rightTopRows: string[],
  rightTopH: number,
  ctx: PanelRenderCtx,
): string[] {
  const lines: string[] = [];
  for (let i = 0; i < rightTopH; i++) {
    lines.push(
      renderPanelRow({
        ...ctx,
        leftContent: getOrPad(ctx.leftRows[i], ctx.leftW),
        rightContent: getOrPad(rightTopRows[i], ctx.rightW),
      }),
    );
  }
  return lines;
}

function renderRightBottomSection(
  rightBottomRows: string[],
  rightBottomH: number,
  rightTopH: number,
  ctx: PanelRenderCtx,
): string[] {
  const lines: string[] = [];
  for (let i = 0; i < rightBottomH; i++) {
    const leftIdx = rightTopH + 3 + i;
    lines.push(
      renderPanelRow({
        ...ctx,
        leftContent: getOrPad(ctx.leftRows[leftIdx], ctx.leftW),
        rightContent: getOrPad(rightBottomRows[i], ctx.rightW),
      }),
    );
  }
  return lines;
}

function renderSplitSeparator(rightTopH: number, ctx: PanelRenderCtx): string {
  const { leftRows, leftW, rightW, lb, rb, mb, border } = ctx;
  return (
    border(lb, BOX.vertical) +
    ensureWidth(leftRows[rightTopH] || "", leftW) +
    border(mb, BOX.teeLeft) +
    border(rb, BOX.horizontal.repeat(rightW)) +
    border(rb, BOX.teeRight)
  );
}

function renderBottomTitleLine(opts: {
  leftRows: string[];
  idx: number;
  rightBottomTitle: string;
  leftW: number;
  rightW: number;
  theme: Theme;
  lb: BorderColor;
  mb: BorderColor;
  rb: BorderColor;
}): string {
  const { leftRows, idx, rightBottomTitle, leftW, rightW, theme, lb, mb, rb } =
    opts;
  const border = (color: BorderColor, s: string) => theme.fg(color, s);
  return (
    border(lb, BOX.vertical) +
    ensureWidth(leftRows[idx] || "", leftW) +
    border(mb, BOX.vertical) +
    theme.fg("accent", pad(rightBottomTitle, rightW)) +
    border(rb, BOX.vertical)
  );
}

function renderBottomSeparatorLine(
  leftRows: string[],
  idx: number,
  ctx: PanelRenderCtx,
): string {
  const { leftW, rightW, lb, rb, mb, border } = ctx;
  return (
    border(lb, BOX.vertical) +
    ensureWidth(leftRows[idx] || "", leftW) +
    border(mb, BOX.teeLeft) +
    border(rb, BOX.horizontal.repeat(rightW)) +
    border(rb, BOX.teeRight)
  );
}

interface PanelRenderCtx {
  leftRows: string[];
  leftW: number;
  rightW: number;
  lb: BorderColor;
  rb: BorderColor;
  mb: BorderColor;
  border: (color: BorderColor, s: string) => string;
}

function getOrPad(row: string | undefined, width: number): string {
  return row || pad("", width);
}

function renderSimplePanel(args: SimplePanelArgs): string[] {
  const {
    leftRows,
    rightRows,
    leftW,
    rightW,
    contentH,
    leftFocus,
    rightFocus,
    theme,
  } = args;
  const lines: string[] = [];
  const { lb, rb, border } = getPanelBorderConfig(leftFocus, rightFocus, theme);
  const mb = getCenterBorderColor(leftFocus, rightFocus);

  for (let i = 0; i < contentH; i++) {
    lines.push(
      renderPanelRow({
        leftContent: leftRows[i] || pad("", leftW),
        rightContent: rightRows[i] || pad("", rightW),
        leftW,
        rightW,
        lb,
        rb,
        mb,
        border,
      }),
    );
  }

  return lines;
}

function renderPanelContent(
  theme: Theme,
  config: SplitPanelConfig,
  dims: SplitPanelDimensions,
  rows: SplitPanelRows,
): string[] {
  const { leftW, rightW, contentH } = dims;

  if (config.rightSplit && dims.rightTopH && dims.rightBottomH) {
    return renderSplitRightPanel({
      leftRows: rows.left,
      rightTopRows: rows.rightTop ?? [],
      rightBottomRows: rows.rightBottom ?? [],
      leftW,
      rightW,
      rightTopH: dims.rightTopH,
      rightBottomH: dims.rightBottomH,
      leftFocus: config.leftFocus,
      rightFocus: config.rightFocus,
      rightBottomTitle: config.rightBottomTitle ?? " Preview",
      theme,
    });
  }

  return renderSimplePanel({
    leftRows: rows.left,
    rightRows: rows.right ?? [],
    leftW,
    rightW,
    contentH,
    leftFocus: config.leftFocus,
    rightFocus: config.rightFocus,
    theme,
  });
}

function renderHeader(
  theme: Theme,
  config: SplitPanelConfig,
  dims: SplitPanelDimensions,
): string[] {
  const { leftW, rightW } = dims;
  return [
    renderTopBorder({
      leftW,
      rightW,
      leftFocus: config.leftFocus,
      rightFocus: config.rightFocus,
      theme,
    }),
    renderTitleRow({
      leftTitle: config.leftTitle,
      rightTitle: config.rightTopTitle ?? config.rightTitle,
      leftW,
      rightW,
      leftFocus: config.leftFocus,
      rightFocus: config.rightFocus,
      theme,
    }),
    renderSeparatorRow({
      leftW,
      rightW,
      leftFocus: config.leftFocus,
      rightFocus: config.rightFocus,
      theme,
    }),
  ];
}

export function renderSplitPanel(
  theme: Theme,
  config: SplitPanelConfig,
  dims: SplitPanelDimensions,
  rows: SplitPanelRows,
): string[] {
  const header = renderHeader(theme, config, dims);
  const content = renderPanelContent(theme, config, dims, rows);
  const bottom = renderBottomBorder({
    leftW: dims.leftW,
    rightW: dims.rightW,
    helpText: config.helpText,
    leftFocus: config.leftFocus,
    rightFocus: config.rightFocus,
    theme,
  });

  return [...header, ...content, ...bottom];
}
