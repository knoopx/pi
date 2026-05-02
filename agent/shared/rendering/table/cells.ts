import { visibleWidth } from "@mariozechner/pi-tui";
export function padEnd(text: string, width: number): string {
  const pad = width - visibleWidth(text);
  return pad > 0 ? text + " ".repeat(pad) : text;
}
export function padStart(text: string, width: number): string {
  const pad = width - visibleWidth(text);
  return pad > 0 ? " ".repeat(pad) + text : text;
}
export function cellStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value as string | number | boolean);
}
