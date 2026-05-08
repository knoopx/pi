import { CancellableLoader } from "@earendil-works/pi-tui";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { BorderedView } from "../../../shared/components/bordered-view";
import type { Theme } from "../shared/types";
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
  createComponent: (theme: Theme, data: TData) => TComponent,
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
    const component = createComponent(theme, data);
    return new BorderedView(
      theme,
      component,
      () => (tui as { requestRender: () => void }).requestRender(),
      done,
    );
  });
}
