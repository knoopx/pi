import { pad } from "../text-utils";

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
