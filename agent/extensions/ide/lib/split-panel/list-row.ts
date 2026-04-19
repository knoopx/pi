import type { Theme } from "@mariozechner/pi-coding-agent";
import { applySelectionBackground, truncateAnsi } from "../text-utils";
import { Row } from "./row";

interface ListRowProps {
  text: string;
  width: number;
  isSelected?: boolean;
  isCurrent?: boolean;
  theme?: Theme;
}


export class ListRow extends Row<Omit<ListRowProps, "width">> {
  protected renderLine(width: number): string {
    const truncated = truncateAnsi(this.props.text, width);

    if (this.props.isSelected && this.props.theme) {
      const styled = this.props.theme.fg(
        "accent",
        this.props.theme.bold(truncated),
      );
      return applySelectionBackground(styled, width, this.props.theme);
    }
    if (this.props.isCurrent && this.props.theme)
      return this.props.theme.fg("warning", truncated);
    return truncated;
  }
}
