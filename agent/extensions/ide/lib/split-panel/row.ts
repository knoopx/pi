import type { Component } from "@mariozechner/pi-tui";


export abstract class Row<P = Record<string, unknown>> implements Component {
  protected readonly props: P;

  constructor(props: P) {
    this.props = props;
  }

  render(width: number): string[] {
    return [this.renderLine(width)];
  }

  invalidate(): void {
    // Rows are ephemeral — no state to invalidate
  }
  dispose(): void {
    // Rows hold no resources to clean up
  }

  protected abstract renderLine(width: number): string;
}
