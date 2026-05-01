import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Row } from "./row";

interface EmptyRowProps {
  message: string;
  theme: Theme;
}

export class EmptyRow extends Row<Omit<EmptyRowProps, "width">> {
  protected renderLine(width: number): string {
    const text = this.props.theme.fg("dim", ` ${this.props.message}`);
    return ensureWidth(text, width);
  }
}

function ensureWidth(text: string, width: number): string {
  const current = visibleWidth(text);
  if (current >= width) return truncateToWidth(text, width, "", true);
  return text + "\x1b[0m" + " ".repeat(width - current);
}
