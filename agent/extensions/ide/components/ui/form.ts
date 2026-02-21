import type { Theme } from "@mariozechner/pi-coding-agent";
import { buildHelpText, ensureWidth } from "../text-utils";
import { borderedLine, bottomBorder } from "./frame";

/** Render form field content with focus styling */
export function renderFormFieldContent(
  theme: Theme,
  labelText: string,
  valueText: string,
  isFocused: boolean,
  innerWidth: number,
): string {
  const content = `${theme.fg("dim", labelText)} ${valueText}`;
  if (isFocused) {
    return theme.bg("selectedBg", ensureWidth(content, innerWidth));
  }
  return content;
}

/** Render form footer with help text and bottom border */
export function renderFormFooter(
  theme: Theme,
  innerWidth: number,
  ...helpParts: string[]
): string[] {
  const helpText = buildHelpText(...helpParts);
  return [
    borderedLine(theme, ` ${theme.fg("dim", helpText)}`, innerWidth),
    bottomBorder(theme, innerWidth),
  ];
}
