import type { Column, MeasuredColumn } from "../types";
import { visibleWidth } from "@earendil-works/pi-tui";
import { cellStr } from "./cells";

export function formatCells(
  columns: Column[],
  rows: Record<string, unknown>[],
): string[][] {
  return rows.map((row) =>
    columns.map((col) => {
      const raw = row[col.key];
      return col.format ? col.format(raw, row) : cellStr(raw);
    }),
  );
}

export function measureColumns(
  columns: Column[],
  formatted: string[][],
): MeasuredColumn[] {
  return columns.map((col, ci) => {
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
}

export function applyWidthConstraint(
  measured: MeasuredColumn[],
  totalNatural: number,
  maxTableWidth: number,
): void {
  if (totalNatural <= maxTableWidth || maxTableWidth === Infinity) return;

  const sepWidth = 3;
  const indent = 0; // handled by caller
  const chrome = indent + sepWidth * (measured.length - 1);
  if (maxTableWidth <= chrome) return;

  const budget = maxTableWidth - chrome;
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
