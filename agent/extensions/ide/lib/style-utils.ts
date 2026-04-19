import type { Theme } from "@mariozechner/pi-coding-agent";
import stringWidth from "string-width";


export function applyFocusedStyle(
  theme: Theme,
  text: string,
  isFocused: boolean,
  width?: number,
): string {
  if (isFocused) {
    const styled = theme.fg("accent", theme.bold(text));
    const pad = Math.max(
      0,
      (width ?? stringWidth(styled)) - stringWidth(styled),
    );
    return theme.bg("selectedBg", styled + " ".repeat(pad));
  }
  return text;
}
