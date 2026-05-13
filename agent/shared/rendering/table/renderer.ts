import type { Column } from "../types";
import { formatCells, measureColumns, applyWidthConstraint } from "./columns";
import { renderHeader, renderSeparator, renderRows } from "./rows";

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

  const formatted = formatCells(columns, rows);
  const measured = measureColumns(columns, formatted);

  const sepWidth = 3;
  const chrome = indent + sepWidth * (measured.length - 1);
  const totalNatural = chrome + measured.reduce((s, c) => s + c.width, 0);

  applyWidthConstraint(measured, totalNatural, maxTableWidth);

  const headerLine = renderHeader(measured, indentStr);
  const separatorLine = renderSeparator(measured, indent);
  const rowLines = renderRows(formatted, measured, indentStr);

  return [headerLine, separatorLine, ...rowLines].join("\n");
}
