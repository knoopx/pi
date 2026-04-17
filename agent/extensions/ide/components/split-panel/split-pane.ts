import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { calculateDimensions } from "./layout";
import { renderSplitPanel } from "./border";

export interface SplitPaneConfig {
  leftTitle: string;
  rightTopTitle?: string;
  rightBottomTitle?: string;
  helpText: string;
  leftFocus: boolean;
  rightFocus?: boolean;
  /** Whether the right pane is vertically split */
  rightSplit?: boolean;
  /** Left panel width ratio (0-1) */
  leftRatio?: number;
  /** Right top section ratio when split */
  rightTopRatio?: number;
}

/** A composite pane that arranges child panes in a split layout. */
interface DisposableComponent extends Component {
  dispose(): void;
}

export class SplitPane implements Component {
  private lastWidth = 0;
  private cachedLines: string[] | null = null;

  constructor(
    private readonly theme: Theme,
    private readonly config: SplitPaneConfig,
    private readonly terminalRows: number,
    private readonly leftPane: DisposableComponent,
    private readonly rightTop?: DisposableComponent,
    private readonly rightBottom?: DisposableComponent,
  ) {}

  render(width: number): string[] {
    if (width === this.lastWidth && this.cachedLines) return this.cachedLines;
    this.lastWidth = width;
    this.cachedLines = null;

    const dims = calculateDimensions(this.terminalRows, width, {
      leftTitle: this.config.leftTitle,
      rightTitle:
        this.config.rightBottomTitle ?? this.config.rightTopTitle ?? "",
      rightTopTitle: this.config.rightTopTitle,
      rightBottomTitle: this.config.rightBottomTitle,
      helpText: this.config.helpText,
      leftFocus: this.config.leftFocus,
      rightFocus: this.config.rightFocus,
      leftRatio: this.config.leftRatio,
      rightSplit: this.config.rightSplit,
      rightTopRatio: this.config.rightTopRatio,
    });

    const rows = {
      left: this.leftPane.render(dims.leftW),
      rightTop: this.rightTop?.render(dims.rightW),
      rightBottom: this.rightBottom?.render(dims.rightW),
    };

    const result = renderSplitPanel(this.theme, this.config as any, dims, rows);
    this.cachedLines = result;
    return result;
  }

  invalidate(): void {
    this.leftPane.invalidate();
    this.rightTop?.invalidate();
    this.rightBottom?.invalidate();
    this.cachedLines = null;
    this.lastWidth = 0;
  }

  dispose(): void {
    this.leftPane.dispose();
    this.rightTop?.dispose();
    this.rightBottom?.dispose();
  }
}
