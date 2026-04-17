import { CancellableLoader, Container, Spacer } from "@mariozechner/pi-tui";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@mariozechner/pi-coding-agent";
import type { Theme as ThemeType } from "../shared/types";

function createBorderedCustomUI<
  T extends {
    render(): string[];
    handleInput(input: string): void;
  },
>(
  tui: unknown,
  theme: {
    fg(c: string, s: string): string;
  },
  done: () => void,
  createComponent: () => T,
): {
  render: (w: number) => string[];
  invalidate: () => void;
  handleInput: (input: string) => void;
  dispose: () => void;
} {
  const container = new Container();
  container.addChild(new Spacer(1));
  container.addChild(new DynamicBorder((s: string) => theme.fg("border", s)));
  container.addChild(new Spacer(1));

  const component = createComponent();

  return {
    render(w: number) {
      const borderLines = container.render(w);
      const componentLines = component.render();
      const bottomBorder = theme.fg("border", "─".repeat(w));
      return [...borderLines, ...componentLines, "", bottomBorder];
    },
    invalidate() {
      container.invalidate();
    },
    handleInput(input: string) {
      component.handleInput(input);
    },
    dispose() {},
  };
}

export async function loadAndDisplay<
  TData,
  TComponent extends {
    render(): string[];
    handleInput(input: string): void;
  },
>(
  ctx: ExtensionCommandContext,
  loaderMessage: string,
  collectData: (signal: AbortSignal) => Promise<TData | null>,
  createComponent: (theme: ThemeType, data: TData) => TComponent,
): Promise<void> {
  if (!ctx.hasUI) return;

  const data = await ctx.ui.custom<TData | null>(
    (tui, theme, keybindings, done) => {
      const loader = new CancellableLoader(
        tui,
        (s: string) => theme.fg("accent", s),
        (s: string) => theme.fg("muted", s),
        loaderMessage,
      );
      let finished = false;
      const finish = (value: TData | null) => {
        if (finished) return;
        finished = true;
        loader.dispose();
        done(value);
      };

      loader.onAbort = () => {
        finish(null);
      };

      collectData(loader.signal)
        .then((result) => {
          finish(result);
        })
        .catch(() => {
          finish(null);
        });

      return loader;
    },
  );

  if (!data) return;

  await ctx.ui.custom<void>((tui, theme, keybindings, done) => {
    return createBorderedCustomUI(tui, theme, done, () =>
      createComponent(theme, data),
    );
  });
}
