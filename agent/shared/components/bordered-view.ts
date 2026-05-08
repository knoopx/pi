import { Container, Spacer } from "@earendil-works/pi-tui";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";

interface Component {
  render(): string[];
  handleInput?(input: string): void;
}

export class BorderedView {
  protected container: Container;
  protected theme: Theme;
  protected component: Component;
  protected requestRender: () => void;
  protected done: () => void;

  constructor(
    theme: Theme,
    component: Component,
    requestRender: () => void,
    done: () => void,
  ) {
    this.theme = theme;
    this.component = component;
    this.requestRender = requestRender;
    this.done = done;

    this.container = new Container();
    this.container.addChild(new Spacer(1));
    this.container.addChild(
      new DynamicBorder((s: string) => theme.fg("border", s)),
    );
    this.container.addChild(new Spacer(1));
  }

  render(width: number): string[] {
    const borderLines = this.container.render(width);
    const componentLines = this.component.render();
    const bottomBorder = this.theme.fg("border", "─".repeat(width));
    return [...borderLines, ...componentLines, "", bottomBorder];
  }

  invalidate(): void {}
}
