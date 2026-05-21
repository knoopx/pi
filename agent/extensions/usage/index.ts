import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadAndDisplay } from "./stats/loader";
import { UsageComponent } from "./stats/component";
import { collectUsageData } from "./stats/data-collection";
import { ToolUsageComponent } from "./tool-usage/component";
import { collectToolStats } from "./tool-usage/data-collection";
import { SkillUsageComponent } from "./skill-usage/component";
import { collectSkillStats } from "./skill-usage/data-collection";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("tool-usage", {
    description: "Show tool usage statistics dashboard",
    async handler(_args: string, ctx) {
      await loadAndDisplay(
        ctx,
        "Loading Tool Usage...",
        collectToolStats,
        (theme, data) => new ToolUsageComponent(theme, data),
      );
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

  pi.registerCommand("skill-usage", {
    description: "Show skill usage statistics dashboard",
    async handler(_args: string, ctx) {
      await loadAndDisplay(
        ctx,
        "Loading Skill Usage...",
        collectSkillStats,
        (theme, data) => new SkillUsageComponent(theme, data),
      );
    },
  });
}
