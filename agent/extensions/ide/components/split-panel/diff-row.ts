import type { Component } from "@mariozechner/pi-tui";
import { visibleWidth } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { ensureWidth, truncateAnsi } from "../text-utils";
import { CachedRow } from "./utils";

export interface DiffRowProps {
  line: string;
  isDivider?: boolean;
  theme: Theme;
}

/** A single source/diff code line rendered as a pi-tui Component. */
export class DiffRow extends CachedRow {
  private readonly props: Omit<DiffRowProps, "width">;

  constructor(props: Omit<DiffRowProps, "width">) {
    super();
    this.props = props;
  }

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

/** Empty placeholder row for no-content state. */
export class EmptyDiffRow extends CachedRow {
  constructor(
    private readonly message: string,
    private readonly theme: Theme,
  ) {
    super();
  }

  protected renderLine(width: number): string {
    const reset = "\x1b[0m";
    return ensureWidth(reset + this.theme.fg("dim", ` ${this.message}`), width);
  }
}

function expandTabs(text: string, tabWidth = 2): string {
  return text.replace(/\t/g, " ".repeat(tabWidth));
}
