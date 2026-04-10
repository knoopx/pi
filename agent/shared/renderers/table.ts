/**
 * Pattern A: List — columnar table with box-drawing.
 *
 * Numbers right-aligned, text left-aligned. Long fields wrap
 * to continuation lines indented 4 spaces from the cell's left edge.
 * One blank line between rows when continuation lines exist.
 */

import { visibleWidth } from "@mariozechner/pi-tui";
import { wrapPlain } from "./text";

// ── Types ────────────────────────────────────────────────

export interface Column {
  /** Column header label */
  key: string;
  /** Right-align values (for numbers) */
  align?: "left" | "right";
  /** Minimum column width */
  minWidth?: number;
  /** Maximum column width before wrapping */
  maxWidth?: number;
  /** Format cell value (return ANSI-colored string) */
  format?: (value: unknown, row: Record<string, unknown>) => string;
}

interface MeasuredColumn extends Column {
  width: number;
}

// ── Helpers ──────────────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

function padEnd(text: string, width: number): string {
  const pad = width - visibleWidth(text);
  return pad > 0 ? text + " ".repeat(pad) : text;
}

function padStart(text: string, width: number): string {
  const pad = width - visibleWidth(text);
  return pad > 0 ? " ".repeat(pad) + text : text;
}

function cellStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

// ── Table renderer ───────────────────────────────────────

/**
 * Render a list of rows as a table following the design system.
 *
 * @param columns   Column definitions (order determines display order)
 * @param rows      Data rows
 * @param options   Optional config
 */
export function table(
  columns: Column[],
  rows: Record<string, unknown>[],
  options: { indent?: number; maxTableWidth?: number } = {},
): string {
  if (rows.length === 0) return "";

  const indent = options.indent ?? 0;
  const indentStr = " ".repeat(indent);
  const maxTableWidth =
    options.maxTableWidth ?? process.stdout.columns ?? Infinity;

  // Format all cells (store both display and plain versions)
  const formatted: string[][] = rows.map((row) =>
    columns.map((col) => {
      const raw = row[col.key];
      return col.format ? col.format(raw, row) : cellStr(raw);
    }),
  );

  // Measure column widths
  const measured: MeasuredColumn[] = columns.map((col, ci) => {
    const headerW = col.key.length;
    const maxCell = formatted.reduce((max, row) => {
      const cell = row[ci];
      const lines = cell.split("\n");
      const lineMax = Math.max(...lines.map((l) => visibleWidth(l)));
      return Math.max(max, lineMax);
    }, 0);
    let width = Math.max(headerW, maxCell);
    if (col.minWidth !== undefined) width = Math.max(width, col.minWidth);
    if (col.maxWidth !== undefined) width = Math.min(width, col.maxWidth);
    return { ...col, width };
  });

  // Constrain total width to terminal/maxTableWidth
  const sepWidth = 3; // " │ "
  const chrome = indent + sepWidth * (measured.length - 1);
  const totalNatural = chrome + measured.reduce((s, c) => s + c.width, 0);

  if (totalNatural > maxTableWidth && maxTableWidth > chrome) {
    const budget = maxTableWidth - chrome;
    // Fixed columns: right-aligned or with explicit minWidth matching current width
    const fixedIndices = new Set(
      measured
        .map((c, i) => (c.align === "right" ? i : -1))
        .filter((i) => i >= 0),
    );
    const fixedTotal = measured.reduce(
      (s, c, i) => s + (fixedIndices.has(i) ? c.width : 0),
      0,
    );
    const flexBudget = budget - fixedTotal;
    const flexIndices = measured
      .map((_, i) => i)
      .filter((i) => !fixedIndices.has(i));
    const flexTotal = flexIndices.reduce((s, i) => s + measured[i].width, 0);

    if (flexBudget > 0 && flexTotal > flexBudget) {
      // Distribute proportionally, respecting minWidth and header width
      for (const i of flexIndices) {
        const col = measured[i];
        const share = Math.max(
          Math.floor((col.width / flexTotal) * flexBudget),
          col.minWidth ?? col.key.length,
        );
        col.width = Math.min(col.width, share);
      }
    }
  }

  const sep = " │ ";

  // ── Header ──
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
  const headerLine = indentStr + headerCells.join(sep);

  // ── Separator ──
  const separatorParts = measured.map((col) => "─".repeat(col.width));
  const separatorLine = "─".repeat(indent) + separatorParts.join("─┼─");

  // ── Rows ──
  const rowLines: string[] = [];
  for (const cells of formatted) {
    // Split on embedded newlines, then word-wrap each segment
    const wrappedCells: string[][] = cells.map((cell, ci) => {
      const col = measured[ci];
      const segments = cell.split("\n");

      const wrapSegment = (seg: string): string[] => {
        const plain = stripAnsi(seg);
        if (plain.length <= col.width) return [seg];
        return wrapPlain(plain, col.width);
      };

      if (segments.length === 1) {
        const lines = wrapSegment(cell);
        if (lines.length <= 1) return [cell];
        return [lines[0], ...lines.slice(1).map((l) => "    " + l)];
      }
      // Multi-line cell — wrap each segment individually
      return segments.flatMap((seg) => wrapSegment(seg));
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
      rowLines.push(indentStr + lineCells.join(sep));
    }
  }

  return [headerLine, separatorLine, ...rowLines].join("\n");
}
