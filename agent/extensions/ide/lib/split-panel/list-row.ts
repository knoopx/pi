import type { Theme } from "@earendil-works/pi-coding-agent";
import { applySelectionBackground } from "../formatting/text";
import { truncateAnsi } from "../../../../shared/format/ansi-text";
import { Row } from "../row";
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
    return this.applyRowStyle(truncated, width);
  }

  private applyRowStyle(truncated: string, width: number): string {
    if (this.props.isSelected && this.props.theme) {
      return this.renderSelected(truncated, width, this.props.theme);
    }
    if (this.props.isCurrent && this.props.theme) {
      return this.props.theme.fg("warning", truncated);
    }
    return truncated;
  }

  private renderSelected(
    truncated: string,
    width: number,
    theme: Theme,
  ): string {
    const styled = theme.fg("accent", theme.bold(truncated));
    return applySelectionBackground(styled, width, theme);
  }
}
