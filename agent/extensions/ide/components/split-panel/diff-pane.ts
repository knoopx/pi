import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { CachedPane } from "./utils";
import { DiffRow } from "./diff-row";
import { ensureWidth } from "../text-utils";
import { renderDiffLinesToRows } from "./content";

export interface DiffPaneProps {
  lines: string[];
  scroll: number;
  width: number;
  height: number;
  title: string;
  focus: "left" | "right";
  theme: Theme;
}

/** Right-bottom pane — diff/content rendered as a pi-tui Component. */
export class DiffPane extends CachedPane {
  constructor(private readonly props: DiffPaneProps) {
    super();
  }

  protected renderContent(width: number): string[] {
    if (this.props.lines.length === 0) {
      return [ensureWidth(this.props.theme.fg("dim", " No content"), width)];
    }

    const visible = this.props.lines.slice(
      this.props.scroll,
      this.props.scroll + this.props.height,
    );
    return renderDiffLinesToRows(visible, width, this.props.theme);
  }
}
