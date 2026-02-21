import { pad, ensureWidth, truncateAnsi } from "../text-utils";

/** Generic loading row renderer */
export function renderLoadingRow(
  width: number,
  message = "Loading...",
): string {
  return pad(` ${message}`, width);
}

/** Generic empty state renderer */
export function renderEmptyState(
  width: number,
  message: string,
  hint?: string,
): string[] {
  const rows = [pad(` ${message}`, width)];
  if (hint) {
    rows.push(pad(` ${hint}`, width));
  }
  return rows;
}

/** Generic row renderer with selection styling */
export function renderSelectableRow(
  text: string,
  width: number,
  isSelected: boolean,
  theme: {
    fg: (color: string, text: string) => string;
    bold: (text: string) => string;
  },
): string {
  const truncated = truncateAnsi(text, width);
  const padded = ensureWidth(truncated, width);
  return isSelected ? theme.fg("accent", theme.bold(padded)) : padded;
}
