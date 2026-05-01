import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Row } from "./row";

interface ListRowProps {
  text: string;
  isSelected?: boolean;
  theme: Theme;
}

export class ListRow extends Row<Omit<ListRowProps, "width">> {
  protected renderLine(width: number): string {
    const truncated = truncateToWidth(this.props.text, width, "", true);

    if (this.props.isSelected) {
      const styled = this.props.theme.fg(
        "accent",
        this.props.theme.bold(truncated),
      );
      return applySelectionBackground(styled, width, this.props.theme);
    }

    return ensureWidth(truncated, width);
  }
}

function applySelectionBackground(
  text: string,
  width: number,
  theme: Theme,
): string {
  const pad = Math.max(0, width - visibleWidth(text));
  return theme.bg("selectedBg", text + " ".repeat(pad));
}

function ensureWidth(text: string, width: number): string {
  const current = visibleWidth(text);
  if (current >= width) return truncateToWidth(text, width, "", true);
  return text + " ".repeat(width - current);
}
