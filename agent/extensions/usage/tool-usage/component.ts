import type { Theme } from "@earendil-works/pi-coding-agent";
import type { ToolStats } from "./types";
import { TabbedUsageComponent } from "../lib/tabbed-usage-component";
import { TotalView } from "../lib/total-view";
import { SessionView } from "../lib/session-view";

class ToolUsageComponent extends TabbedUsageComponent<
  ToolStats,
  TotalView,
  SessionView
> {
  constructor(theme: Theme, data: ToolStats) {
    super(
      theme,
      data,
      {
        title: "Tool Usage",
        metricLabel: "Tool Calls",
        getMetricCount: (d: ToolStats) => d.totalToolCalls,
      },
      new TotalView(theme, data, {
        emptyMessage: "  No tool usage data",
        getItemMap: (d) => (d as ToolStats).byTool,
        getTotalCount: (d) => (d as ToolStats).totalToolCalls,
      }),
      new SessionView(theme, data, {
        getSessions: (d) =>
          Object.entries((d as ToolStats).bySession).sort(
            ([, a], [, b]) => b.count - a.count,
          ),
        getDetails: (e) => (e as { tools: Record<string, number> }).tools,
      }),
    );
  }
}

export { ToolUsageComponent };
