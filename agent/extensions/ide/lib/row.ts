import type { Component } from "@earendil-works/pi-tui";

export abstract class Row<P = Record<string, never>> implements Component {
  protected readonly props: P;

  constructor(props: P) {
    this.props = props;
  }

  render(width: number): string[] {
    return [this.renderLine(width)];
  }

  invalidate(): void {}

  protected abstract renderLine(width: number): string;
}
