import type { Theme } from "@mariozechner/pi-coding-agent";
import { pad, ensureWidth } from "../text-utils";

/** Box drawing characters for bordered UI components */
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

/** Create a bordered line with vertical bars on each side */
export function borderedLine(
  theme: Theme,
  content: string,
  innerWidth: number,
): string {
  const inner = ensureWidth(content, innerWidth);
  return `${theme.fg("dim", BOX.vertical)}${inner}${theme.fg("dim", BOX.vertical)}`;
}

/** Create a top border with centered title */
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

/** Create a horizontal separator with tee connectors */
export function horizontalSeparator(theme: Theme, innerWidth: number): string {
  return (
    theme.fg("dim", BOX.teeLeft) +
    theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
    theme.fg("dim", BOX.teeRight)
  );
}

/** Create a bottom border */
export function bottomBorder(theme: Theme, innerWidth: number): string {
  return (
    theme.fg("dim", BOX.bottomLeft) +
    theme.fg("dim", BOX.horizontal.repeat(innerWidth)) +
    theme.fg("dim", BOX.bottomRight)
  );
}

/** Wrap rows in a single-panel border frame */
export function renderFramedRows(
  theme: Theme,
  rows: string[],
  width: number,
  borderColor: "border" | "borderAccent" = "borderAccent",
): string[] {
  const innerWidth = Math.max(1, width - 2);

  const top =
    theme.fg(borderColor, "┌") +
    theme.fg(borderColor, "─".repeat(innerWidth)) +
    theme.fg(borderColor, "┐");

  const bottom =
    theme.fg(borderColor, "└") +
    theme.fg(borderColor, "─".repeat(innerWidth)) +
    theme.fg(borderColor, "┘");

  const content = rows.map(
    (row) =>
      theme.fg(borderColor, "│") +
      pad(row, innerWidth) +
      theme.fg(borderColor, "│"),
  );

  return [top, ...content, bottom];
}
