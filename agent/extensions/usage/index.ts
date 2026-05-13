import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { BorderedView } from "../../shared/components/bordered-view";
import { loadAndDisplay } from "./stats/loader";
import { UsageComponent } from "./stats/component";
import { collectUsageData } from "./stats/data-collection";
import { ToolUsageComponent } from "./tool-usage/component";
import { collectToolStats } from "./tool-usage/data-collection";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("tool-usage", {
    description: "Show tool usage statistics dashboard",
    async handler(_args: string, ctx) {
      if (!ctx.hasUI) return;
      const data = await collectToolStats();
      if (!data) return;

      await ctx.ui.custom<void>((tui, theme, _keybindings, done) => {
        const requestRender = () =>
          (tui as { requestRender: () => void }).requestRender();
        const component = new ToolUsageComponent(
          theme,
          data,
          requestRender,
          done,
        );

        return new BorderedView(theme, component, requestRender, done);
      });
    },
  });

  pi.registerCommand("usage", {
    description: "Show usage statistics dashboard",
    async handler(_args: string, ctx) {
      await loadAndDisplay(
        ctx,
        "Loading Usage...",
        collectUsageData,
        (theme, data) =>
          new UsageComponent(
            theme,
            data,
            () => {},
            () => {},
          ),
      );
    },
  });
}
