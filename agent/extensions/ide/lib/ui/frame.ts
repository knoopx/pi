import type { Theme } from "@earendil-works/pi-coding-agent";
import { ensureWidth } from "../../../../shared/format/ansi-text";
export const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeLeft: "├",
  teeRight: "┤",
  teeDown: "┬",
  teeUp: "┴",
  cross: "┼",
} as const;
export function borderedLine(
  theme: Theme,
  content: string,
  innerWidth: number,
): string {
  const inner = ensureWidth(content, innerWidth);
  return `${theme.fg("dim", BOX.vertical)}${inner}${theme.fg("dim", BOX.vertical)}`;
}
export function topBorderWithTitle(
  theme: Theme,
  title: string,
  innerWidth: number,
): string {
  const titleLen = title.length;
  const leftPad = Math.floor((innerWidth - titleLen) / 2);
  const rightPad = innerWidth - titleLen - leftPad;
  return (
    theme.fg("dim", BOX.topLeft + BOX.horizontal.repeat(leftPad)) +
    theme.fg("accent", theme.bold(title)) +
    theme.fg("dim", BOX.horizontal.repeat(rightPad) + BOX.topRight)
  );
}
export function horizontalSeparator(theme: Theme, innerWidth: number): string {
  return (
    theme.fg("dim", BOX.teeLeft) +
    theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
    theme.fg("dim", BOX.teeRight)
  );
}
export function bottomBorder(theme: Theme, innerWidth: number): string {
  return (
    theme.fg("dim", BOX.bottomLeft) +
    theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
    theme.fg("dim", BOX.bottomRight)
  );
}
