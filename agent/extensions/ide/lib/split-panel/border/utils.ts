import type { Theme } from "@earendil-works/pi-coding-agent";
import { ensureWidth } from "../../../../../shared/format/ansi-text";
import { BOX } from "../../ui/frame";
import type {
  BorderColor,
  PanelRowArgs,
  BorderRowArgs,
  FocusedRowArgs,
} from "./types";

export function createBorderFn(
  theme: Theme,
): (color: BorderColor, s: string) => string {
  return (color, s) => theme.fg(color, s);
}

export function getBorderColor(focus: boolean | undefined): BorderColor {
  return focus ? "borderAccent" : "border";
}

export function getCenterBorderColor(
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
): BorderColor {
  return leftFocus || rightFocus ? "borderAccent" : "border";
}

export function renderPanelRow(args: PanelRowArgs): string {
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

export function createFocusedRowRenderer(
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

export function getPanelBorderConfig(
  leftFocus: boolean | undefined,
  rightFocus: boolean | undefined,
  theme: Theme,
) {
  const lb: BorderColor = leftFocus ? "borderAccent" : "border";
  const rb: BorderColor = rightFocus ? "borderAccent" : "border";
  const border = (color: BorderColor, s: string) => theme.fg(color, s);
  return { lb, rb, border };
}

export function getOrPad(row: string | undefined, width: number): string {
  return row || pad("", width);
}

function pad(str: string, width: number): string {
  return str.padEnd(width);
}
