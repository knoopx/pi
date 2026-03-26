/**
 * Joiners, dividers, and state indicators.
 */

/**
 * Join segments with ` • ` separators.
 *
 * @example
 *   dotJoin("r/linux", "hot", "12 results")
 *   dotJoin('"ripgrep"', "9 results")
 */
export function dotJoin(...segments: string[]): string {
  return segments.join(" • ");
}

function termWidth(fallback: number): number {
  return process.stdout.columns ?? fallback;
}

/**
 * Section divider with optional embedded label.
 *
 * @example
 *   sectionDivider("Quant Files (25)")
 *   sectionDivider()  // plain rule
 */
export function sectionDivider(label?: string, width?: number): string {
  const w = width ?? termWidth(60);
  if (!label) {
    return "─".repeat(w);
  }
  const prefix = "─── ";
  const labelPart = `${label} `;
  const remaining = Math.max(0, w - prefix.length - labelPart.length);
  return prefix + labelPart + "─".repeat(remaining);
}

/**
 * Thread/comment separator.
 *
 * @example
 *   threadSeparator("flat-line", "2026-03-05")
 *   threadSeparator("danielhanchen", "2026-03-06", "status → closed")
 */
export function threadSeparator(
  author: string,
  date: string,
  suffix?: string,
  width?: number,
): string {
  const w = width ?? termWidth(60);
  let label = `── ${author} • ${date}`;
  if (suffix) label += ` • ${suffix}`;
  label += " ";
  const remaining = Math.max(0, w - label.length);
  return label + "─".repeat(remaining);
}

/** State dot: ● on/open/warning/off, ○ inactive */
export function stateDot(
  state: "on" | "off" | "warning" | "inactive" | boolean,
): string {
  return state === "off" || state === "inactive" || state === false ? "○" : "●";
}

/**
 * Count label: "3 result(s)", "0 window(s)".
 *
 * @example
 *   countLabel(1, "result")   // "1 result(s)"
 *   countLabel(5, "window")   // "5 window(s)"
 */
export function countLabel(n: number | string, noun: string): string {
  return `${n} ${noun}(s)`;
}
