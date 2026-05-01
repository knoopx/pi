import type { Component } from "@mariozechner/pi-tui";
export abstract class Row<P = Record<string, unknown>> implements Component {
  protected readonly props: P;

  constructor(props: P) {
    this.props = props;
  }

  render(width: number): string[] {
    return [this.renderLine(width)];
  }

  invalidate(): void {}
  dispose(): void {}

  protected abstract renderLine(width: number): string;
}
