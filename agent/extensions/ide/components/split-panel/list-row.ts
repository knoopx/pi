import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { ensureWidth, truncateAnsi } from "../text-utils";
import { CachedRow } from "./utils";

export interface ListRowProps {
  text: string;
  width: number;
  isSelected?: boolean;
  isCurrent?: boolean;
  theme?: Theme;
}

/** Generic list row rendered as a pi-tui Component. */
export class ListRow extends CachedRow {
  private readonly props: Omit<ListRowProps, "width">;

  constructor(props: Omit<ListRowProps, "width">) {
    super();
    this.props = props;
  }

  protected renderLine(width: number): string {
    const truncated = truncateAnsi(this.props.text, width);

    if (this.props.isSelected && this.props.theme) {
      const styled = this.props.theme.fg(
        "accent",
        this.props.theme.bold(truncated),
      );
      // Pad content to full width then apply bg so spaces also get background
      const visibleLen = visibleWidth(styled);
      const pad = Math.max(0, width - visibleLen);
      return this.props.theme.bg("selectedBg", styled + " ".repeat(pad));
    }
    if (this.props.isCurrent && this.props.theme)
      return this.props.theme.fg("warning", truncated);
    return truncated;
  }
}
