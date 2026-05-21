import type { Theme } from "@earendil-works/pi-coding-agent";
import type { SkillStats } from "./types";
import { TabbedUsageComponent } from "../lib/tabbed-usage-component";
import { TotalView } from "../lib/total-view";
import { SessionView } from "../lib/session-view";

class SkillUsageComponent extends TabbedUsageComponent<
  SkillStats,
  TotalView,
  SessionView
> {
  constructor(theme: Theme, data: SkillStats) {
    super(
      theme,
      data,
      {
        title: "Skill Usage",
        metricLabel: "Skill Calls",
        getMetricCount: (d: SkillStats) => d.totalSkillCalls,
      },
      new TotalView(theme, data, {
        emptyMessage: "  No skill usage data",
        getItemMap: (d) => (d as SkillStats).bySkill,
        getTotalCount: (d) => (d as SkillStats).totalSkillCalls,
        minNameWidth: 14,
      }),
      new SessionView(theme, data, {
        getSessions: (d) =>
          Object.entries((d as SkillStats).bySession).sort(
            ([, a], [, b]) => b.count - a.count,
          ),
        getDetails: (e) => (e as { skills: Record<string, number> }).skills,
      }),
    );
  }
}

export { SkillUsageComponent };
