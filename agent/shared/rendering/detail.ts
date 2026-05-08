import { visibleWidth } from "@earendil-works/pi-tui";
import { wrapPlain } from "./text";
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function padStart(text: string, width: number): string {
  const pad = width - visibleWidth(text);
  return pad > 0 ? " ".repeat(pad) + text : text;
}
interface DetailField {
  label: string;

  value: string;
}
export function detail(
  fields: DetailField[],
  options: { maxWidth?: number } = {},
): string {
  if (fields.length === 0) return "";
  const totalWidth =
    (options.maxWidth ??
    (typeof process !== "undefined" && process.stdout?.columns))
      ? process.stdout.columns
      : Infinity;
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
      const wrapped =
        valueWidth === Infinity
          ? lines
          : lines.flatMap((l) => wrapPlain(l, valueWidth));

      if (wrapped.length === 1) {
        return `${label}${sep}${wrapped[0]}`;
      }
      const continuation = wrapped
        .slice(1)
        .map((line) => `${blankLabel}${sep}${line}`);
      return [`${label}${sep}${wrapped[0]}`, ...continuation].join("\n");
    })
    .join("\n");
}
