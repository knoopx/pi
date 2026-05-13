import { pad } from "../../../../../shared/format/ansi-text";
import { BOX } from "../../ui/frame";
import type {
  TopBorderArgs,
  TitleRowArgs,
  SeparatorRowArgs,
  BottomBorderArgs,
} from "./types";
import {
  createBorderFn,
  getBorderColor,
  getCenterBorderColor,
  createFocusedRowRenderer,
} from "./utils";

export function renderTopBorder(args: TopBorderArgs): string {
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

export function renderTitleRow(args: TitleRowArgs): string {
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

export function renderSeparatorRow(args: SeparatorRowArgs): string {
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

export function renderBottomBorder(args: BottomBorderArgs): string[] {
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
