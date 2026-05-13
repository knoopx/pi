import type { Theme } from "@earendil-works/pi-coding-agent";
import { ensureWidth } from "../../../../shared/format/ansi-text";
import { renderDiffLinesToRows } from "./content";
interface DiffPaneProps {
  lines: string[];
  scroll: number;
  width: number;
  height: number;
  title: string;
  focus: "left" | "right";
  theme: Theme;
}
export class DiffPane {
  constructor(private readonly props: DiffPaneProps) {}

  render(width: number): string[] {
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
