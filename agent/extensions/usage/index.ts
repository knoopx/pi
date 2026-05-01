export { getSessionsDir, collectUsageData } from "./usage/data-collection";
export { UsageComponent } from "./usage/component";
export { loadAndDisplay } from "./usage/ui-loading";
export { ToolUsageComponent } from "./tool-usage/component";
export { collectToolStats } from "./tool-usage/data-collection";
export { formatCost, formatTokens, formatNumber } from "./shared/formatters";
export { padLeft, padRight } from "./shared/padding";
export { handleUsageInput } from "./shared/input-handling";
export { NAME_COL_WIDTH, DATA_COLUMNS, TABLE_WIDTH } from "./shared/ui-helpers";
export type { UsageData } from "./usage/types";
export type { ToolStats } from "./tool-usage/types";
export type { BaseStats } from "./shared/types";

// Extension entry point — registers commands using the extracted components
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { BorderedView } from "../../shared/components";
import { loadAndDisplay } from "./usage/ui-loading";
import { UsageComponent } from "./usage/component";
import { collectUsageData } from "./usage/data-collection";
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
