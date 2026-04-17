import { truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme as ThemeType } from "../shared/types";
import { handleUsageInput } from "../shared/input-handling";
import { formatNumber } from "../shared/formatting";
import type { ToolStats, ToolTabName } from "./types";

const TOOL_TAB_LABELS: Record<ToolTabName, string> = {
  byTool: "By Tool",
  byDate: "By Date",
  bySession: "By Session",
};

const TOOL_TAB_ORDER: ToolTabName[] = ["byTool", "byDate", "bySession"];

class ToolUsageComponent {
  private activeTab: ToolTabName = "byTool";
  private data: ToolStats;
  private selectedIndex = 0;
  private theme: ThemeType;
  private requestRender: () => void;
  private done: () => void;

  constructor(
    theme: ThemeType,
    data: ToolStats,
    requestRender: () => void,
    done: () => void,
  ) {
    this.theme = theme;
    this.data = data;
    this.requestRender = requestRender;
    this.done = done;
  }

  private getRowCount(): number {
    switch (this.activeTab) {
      case "byTool":
        return Math.min(Object.keys(this.data.byTool).length, 20);
      case "byDate":
        return Object.keys(this.data.byDate).length;
      case "bySession":
        return Math.min(Object.keys(this.data.bySession).length, 20);
      default:
        return 0;
    }
  }

  handleInput(data: string): void {
    handleUsageInput(data, {
      done: this.done,
      onTabForward: () => {
        this.cycleToolTab(1);
      },
      onTabBackward: () => {
        this.cycleToolTab(-1);
      },
      onUp: () => {
        if (this.selectedIndex > 0) {
          this.selectedIndex--;
          this.requestRender();
        }
      },
      onDown: () => {
        const maxIdx = this.getRowCount() - 1;
        if (this.selectedIndex < maxIdx) {
          this.selectedIndex++;
          this.requestRender();
        }
      },
    });
  }

  private cycleToolTab(direction: number): void {
    const idx = TOOL_TAB_ORDER.indexOf(this.activeTab);
    this.activeTab =
      TOOL_TAB_ORDER[
        (idx + direction + TOOL_TAB_ORDER.length) % TOOL_TAB_ORDER.length
      ];
    this.selectedIndex = 0;
    this.requestRender();
  }

  render(): string[] {
    return [
      ...this.renderTitle(),
      ...this.renderTabs(),
      ...this.renderContent(),
      ...this.renderInsights(),
      ...this.renderHelp(),
    ];
  }

  private renderTitle(): string[] {
    const th = this.theme;
    return [
      th.fg("accent", th.bold("Tool Usage Statistics")),
      "",
      `Sessions: ${formatNumber(this.data.totalSessions)}  |  Tool Calls: ${formatNumber(this.data.totalToolCalls)}`,
      "",
    ];
  }

  private renderTabs(): string[] {
    const th = this.theme;
    const tabs = TOOL_TAB_ORDER.map((tab) => {
      const label = TOOL_TAB_LABELS[tab];
      return tab === this.activeTab
        ? th.fg("accent", `[${label}]`)
        : th.fg("dim", ` ${label} `);
    }).join("  ");
    return [tabs, ""];
  }

  private renderContent(): string[] {
    switch (this.activeTab) {
      case "byTool":
        return this.renderByTool();
      case "byDate":
        return this.renderByDate();
      case "bySession":
        return this.renderBySession();
      default:
        return [];
    }
  }

  private renderByTool(): string[] {
    const th = this.theme;
    const lines: string[] = [];
    const sortedTools = Object.entries(this.data.byTool)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);

    if (sortedTools.length === 0) {
      lines.push(th.fg("dim", "  No tool usage data"));
      return lines;
    }

    const maxNameLen = Math.max(
      ...sortedTools.map(([name]) => name.length),
      10,
    );
    const maxCount = sortedTools[0]?.[1] || 0;
    const barWidth = 30;

    for (let i = 0; i < sortedTools.length; i++) {
      const [name, count] = sortedTools[i];
      const pct = ((count / this.data.totalToolCalls) * 100).toFixed(1);
      const barLen = Math.round((count / maxCount) * barWidth);
      const bar = "█".repeat(barLen);
      const isSelected = i === this.selectedIndex;

      const nameStr = isSelected
        ? th.fg("accent", name.padEnd(maxNameLen))
        : name.padEnd(maxNameLen);
      const countStr = String(count).padStart(6);
      const pctStr = `(${pct.padStart(5)}%)`;

      lines.push(
        `  ${nameStr}  ${countStr}  ${th.fg("dim", pctStr)}  ${th.fg("accent", bar)}`,
      );
    }

    return [...lines, ""];
  }

  private renderByDate(): string[] {
    const th = this.theme;
    const lines: string[] = [];
    const sortedDates = Object.entries(this.data.byDate).sort(([a], [b]) =>
      b.localeCompare(a),
    );

    if (sortedDates.length === 0) {
      lines.push(th.fg("dim", "  No date data"));
      return lines;
    }

    for (let i = 0; i < sortedDates.length; i++) {
      const [date, data] = sortedDates[i];
      const topTools = Object.entries(data.tools)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([t, c]) => `${t}(${c})`)
        .join(", ");

      const isSelected = i === this.selectedIndex;
      const dateStr = isSelected ? th.fg("accent", date) : date;
      const countStr = String(data.count).padStart(5);

      lines.push(
        `  ${dateStr}  ${countStr} calls  → ${th.fg("dim", topTools)}`,
      );
    }

    return [...lines, ""];
  }

  private renderBySession(): string[] {
    const th = this.theme;
    const lines: string[] = [];
    const sortedSessions = Object.entries(this.data.bySession)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 20);

    if (sortedSessions.length === 0) {
      lines.push(th.fg("dim", "  No session data"));
      return lines;
    }

    for (let i = 0; i < sortedSessions.length; i++) {
      const [session, data] = sortedSessions[i];
      const shortName = truncateToWidth(
        session.replace(/--/g, "/").replace(/^\//, ""),
        40,
      );
      const topTools = Object.entries(data.tools)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([t, c]) => `${t}(${c})`)
        .join(", ");

      const isSelected = i === this.selectedIndex;
      const nameStr = isSelected
        ? th.fg("accent", padRight(shortName, 42))
        : padRight(shortName, 42);
      const countStr = String(data.count).padStart(5);

      lines.push(`  ${nameStr} ${countStr} → ${th.fg("dim", topTools)}`);
    }

    return [...lines, ""];
  }

  private renderInsights(): string[] {
    const th = this.theme;
    const lines: string[] = [th.fg("border", "─".repeat(70)), ""];

    const sortedTools = Object.entries(this.data.byTool).sort(
      ([, a], [, b]) => b - a,
    );
    const topTool = sortedTools[0];
    if (topTool) {
      const pct = ((topTool[1] / this.data.totalToolCalls) * 100).toFixed(1);
      lines.push(
        `  Most used: ${th.fg("accent", topTool[0])} (${topTool[1]} calls, ${pct}%)`,
      );
    }

    const avgPerSession = (
      this.data.totalToolCalls / this.data.totalSessions
    ).toFixed(1);
    lines.push(
      `  Avg per session: ${avgPerSession}  |  Unique tools: ${Object.keys(this.data.byTool).length}`,
    );

    return [...lines, ""];
  }

  private renderHelp(): string[] {
    return [this.theme.fg("dim", "[Tab/←→] view  [↑↓] select  [q] close")];
  }
}

function padRight(s: string, len: number): string {
  const visibleWidth = s.length;
  if (visibleWidth >= len) return s;
  return s + " ".repeat(len - visibleWidth);
}

export { ToolUsageComponent };
