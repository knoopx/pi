/**
 * Pattern B: Detail / Single Entity — key-value pairs with right-aligned labels.
 *
 * Labels right-align to the longest label within each section.
 * Short related fields pack on the same line separated by mid-dots.
 * Sections divided by labeled ─── lines.
 */

import { visibleWidth } from "@mariozechner/pi-tui";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

function padStart(text: string, width: number): string {
  const pad = width - visibleWidth(text);
  return pad > 0 ? " ".repeat(pad) + text : text;
}

function padEnd(text: string, width: number): string {
  const pad = width - visibleWidth(text);
  return pad > 0 ? text + " ".repeat(pad) : text;
}

export interface DetailField {
  /** Label (left side of │) */
  label: string;
  /** Value (right side of │), may contain ANSI codes */
  value: string;
}

/**
 * Word-wrap plain text to lines of maxWidth, breaking at word boundaries.
 */
function wrapPlain(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  const plain = text.replace(ANSI_RE, "");
  if (plain.length <= maxWidth) return [text];

  const words = plain.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);

  // Hard-break any line still exceeding maxWidth
  return lines.flatMap((line) => {
    if (line.length <= maxWidth) return [line];
    const chunks: string[] = [];
    for (let i = 0; i < line.length; i += maxWidth) {
      chunks.push(line.slice(i, i + maxWidth));
    }
    return chunks;
  });
}

/**
 * Render key-value detail fields with right-aligned labels.
 *
 * Labels right-align to the longest label. Values are left-aligned
 * after the │ separator. Multi-line values wrap with the │ column
 * maintained.
 *
 * @param fields          Key-value pairs to render
 * @param options.maxWidth  Maximum total line width (defaults to terminal width)
 *
 * @example
 *   detail([
 *     { label: "name", value: "express" },
 *     { label: "version", value: "5.2.1" },
 *     { label: "license", value: "MIT" },
 *   ])
 */
export function detail(
  fields: DetailField[],
  options: { maxWidth?: number } = {},
): string {
  if (fields.length === 0) return "";

  const totalWidth = options.maxWidth ?? process.stdout.columns ?? Infinity;

  const maxLabelWidth = fields.reduce(
    (max, f) => Math.max(max, f.label.replace(ANSI_RE, "").length),
    0,
  );

  const sep = " │ ";
  const blankLabel = " ".repeat(maxLabelWidth);
  const chrome = maxLabelWidth + sep.length;
  const valueWidth = totalWidth === Infinity ? Infinity : totalWidth - chrome;

  return fields
    .map((f) => {
      const label = padStart(f.label, maxLabelWidth);
      const lines = f.value.split("\n");

      // Wrap each line to valueWidth
      const wrapped =
        valueWidth === Infinity
          ? lines
          : lines.flatMap((l) => wrapPlain(l, valueWidth));

      if (wrapped.length === 1) {
        return `${label}${sep}${wrapped[0]}`;
      }

      // Multi-line: first line with label, rest with blank padding
      const continuation = wrapped
        .slice(1)
        .map((line) => `${blankLabel}${sep}${padEnd("", 4)}${line}`);
      return [`${label}${sep}${wrapped[0]}`, ...continuation].join("\n");
    })
    .join("\n");
}
