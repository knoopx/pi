import { wrapPlain } from "../text";
import type { MeasuredColumn } from "../types";
import { padEnd, padStart } from "./cells";

const SEP = " │ ";

export function renderHeader(
  measured: MeasuredColumn[],
  indentStr: string,
): string {
  const headerCells = measured.map((col, i) => {
    const isLast = i === measured.length - 1;
    const aligned =
      col.align === "right"
        ? padStart(col.key, col.width)
        : isLast
          ? col.key
          : padEnd(col.key, col.width);
    return aligned;
  });
  return indentStr + headerCells.join(SEP);
}

export function renderSeparator(
  measured: MeasuredColumn[],
  indent: number,
): string {
  const separatorParts = measured.map((col) => "─".repeat(col.width));
  return "─".repeat(indent) + separatorParts.join("─┼─");
}

export function renderRows(
  formatted: string[][],
  measured: MeasuredColumn[],
  indentStr: string,
): string[] {
  const rowLines: string[] = [];

  for (const cells of formatted) {
    const wrappedCells = cells.map((cell, ci) => {
      const col = measured[ci];
      const segments = cell.split("\n").filter((s) => s !== "");

      if (segments.length === 0) return [""];

      const wrapSegment = (seg: string): string[] => {
        const plain = seg;
        if (plain.length <= col.width) return [seg];
        return wrapPlain(plain, col.width);
      };

      if (segments.length === 1) {
        const lines = wrapSegment(segments[0]);
        if (lines.length <= 1) return lines;
        return [lines[0], ...lines.slice(1).map((l) => `    ${l}`)];
      }

      const wrappedSegments = segments.map((seg) =>
        wrapSegment(seg).join("\n"),
      );
      const joined = wrappedSegments.join("\n");
      return joined.split("\n");
    });

    const maxLines = Math.max(...wrappedCells.map((wc) => wc.length));

    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      const lineCells = wrappedCells.map((wc, ci) => {
        const col = measured[ci];
        const isLast = ci === measured.length - 1;
        const text = lineIdx < wc.length ? wc[lineIdx] : "";
        if (col.align === "right") return padStart(text, col.width);
        return isLast ? text : padEnd(text, col.width);
      });
      rowLines.push(indentStr + lineCells.join(SEP));
    }
  }

  return rowLines;
}
