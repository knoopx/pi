import type { Theme } from "@mariozechner/pi-coding-agent";
import { ensureWidth, truncateAnsi } from "../text-utils";
import { Row } from "./row";

interface DiffRowProps {
  line: string;
  isDivider?: boolean;
  theme: Theme;
}


export class DiffRow extends Row<Omit<DiffRowProps, "width">> {
  protected renderLine(width: number): string {
    const reset = "\x1b[0m";

    if (this.props.isDivider) {
      return ensureWidth(
        reset + this.props.theme.fg("muted", this.props.line),
        width,
      );
    }

    const expanded = expandTabs(this.props.line);
    const content = ` ${expanded}`;
    const truncated = truncateAnsi(content, width - 1);
    return ensureWidth(reset + truncated, width);
  }
}

function expandTabs(text: string, tabWidth = 2): string {
  return text.replace(/\t/g, " ".repeat(tabWidth));
}
