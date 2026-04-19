import { truncateToWidth } from "@mariozechner/pi-tui";
import type { Theme } from "../shared/types";
import type { BaseStats } from "../shared/types";
import type { UsageData, TabName, ProviderStats } from "./types";
import { handleUsageInput } from "../shared/input-handling";
import { padRight, padLeft } from "../shared/padding";
import {
  NAME_COL_WIDTH,
  DATA_COLUMNS,
  TABLE_WIDTH,
} from "../shared/ui-helpers";

interface IUsageComponent {
  render(): string[];
  handleInput(data: string): void;
}

const TAB_LABELS: Record<TabName, string> = {
  today: "Today",
  thisWeek: "This Week",
  allTime: "All Time",
};

const TAB_ORDER: TabName[] = ["today", "thisWeek", "allTime"];

export class UsageComponent implements IUsageComponent {
  activeTab: TabName = "today";
  private data: UsageData;
  selectedIndex = 0;
  expanded = new Set<string>();
  providerOrder: string[] = [];
  private theme: Theme;
  private requestRender: () => void;
  private done: () => void;

  constructor(
    theme: Theme,
    data: UsageData,
    requestRender: () => void,
    done: () => void,
  ) {
    this.theme = theme;
    this.requestRender = requestRender;
    this.done = done;
    this.data = data;
    this.updateProviderOrder();
  }

  private updateProviderOrder(): void {
    const statsData = this.data[this.activeTab];
    const providersWithUsage = Array.from(statsData.providers.entries())
      .filter(([_, providerStats]) => {
        const sessionCount =
          typeof providerStats.sessions === "number"
            ? providerStats.sessions
            : providerStats.sessions.size;
        return (
          sessionCount > 0 &&
          providerStats.messages > 0 &&
          providerStats.tokens.total > 0
        );
      })
      .sort((a, b) => b[1].cost - a[1].cost)
      .map(([name]) => name);
    this.providerOrder = providersWithUsage;
    this.selectedIndex = Math.min(
      this.selectedIndex,
      Math.max(0, this.providerOrder.length - 1),
    );
  }

  handleInput(data: string): void {
    handleUsageInput(data, {
      done: this.done,
      onTabForward: () => {
        this.cycleTab(1);
      },
      onTabBackward: () => {
        this.cycleTab(-1);
      },
      onUp: () => {
        this.navigateSelection(-1);
      },
      onDown: () => {
        this.navigateSelection(1);
      },
      onEnter: () => {
        this.toggleProvider();
      },
    });
  }

  cycleTab(direction: number): void {
    const idx = TAB_ORDER.indexOf(this.activeTab);
    const newIdx = (idx + direction + TAB_ORDER.length) % TAB_ORDER.length;
    this.activeTab = TAB_ORDER[newIdx];
    this.updateProviderOrder();
    this.requestRender();
  }

  navigateSelection(direction: number): void {
    const newIdx = this.selectedIndex + direction;
    if (newIdx < 0 || newIdx >= this.providerOrder.length) return;
    this.selectedIndex = newIdx;
    this.requestRender();
  }

  toggleProvider(): void {
    const provider = this.providerOrder[this.selectedIndex];
    if (!provider) return;
    if (this.expanded.has(provider)) this.expanded.delete(provider);
    else {
      this.expanded.add(provider);
    }
    this.requestRender();
  }

  render(): string[] {
    return [
      ...this.renderTitle(),
      ...this.renderTabs(),
      ...this.renderHeader(),
      ...this.renderRows(),
      ...this.renderTotals(),
      ...this.renderHelp(),
    ];
  }

  private renderTitle(): string[] {
    const th = this.theme;
    return [th.fg("accent", th.bold("Usage Statistics")), ""];
  }

  private renderTabs(): string[] {
    const th = this.theme;
    const tabs = TAB_ORDER.map((tab) => {
      const label = TAB_LABELS[tab];
      return tab === this.activeTab
        ? th.fg("accent", `[${label}]`)
        : th.fg("dim", ` ${label} `);
    }).join("  ");
    return [tabs, ""];
  }

  private renderHeader(): string[] {
    const th = this.theme;

    let headerLine = padRight("Provider / Model", NAME_COL_WIDTH);
    for (const col of DATA_COLUMNS) {
      const label = padLeft(col.label, col.width);
      headerLine += col.dimmed ? th.fg("dim", label) : label;
    }

    return [
      th.fg("muted", headerLine),
      th.fg("border", "─".repeat(TABLE_WIDTH)),
    ];
  }

  private renderDataRow(
    name: string,
    stats: BaseStats & { sessions: Set<string> | number },
    options: { indent?: number; selected?: boolean; dimAll?: boolean } = {},
  ): string {
    const th = this.theme;
    const { indent = 0, selected = false, dimAll = false } = options;

    const indentStr = " ".repeat(indent);
    const nameWidth = NAME_COL_WIDTH - indent;
    const truncName = truncateToWidth(name, nameWidth - 1);
    const styledName = selected
      ? th.fg("accent", truncName)
      : dimAll
        ? th.fg("dim", truncName)
        : truncName;

    let row = indentStr + padRight(styledName, nameWidth);

    for (const col of DATA_COLUMNS) {
      const value = col.getValue(stats);
      const shouldDim = col.dimmed || dimAll;
      row += shouldDim
        ? th.fg("dim", padLeft(value, col.width))
        : padLeft(value, col.width);
    }

    return row;
  }

  private renderRows(): string[] {
    const th = this.theme;
    const stats = this.data[this.activeTab];
    const lines: string[] = [];

    if (this.providerOrder.length === 0) {
      lines.push(th.fg("dim", "  No usage data for this period"));
      return lines;
    }

    for (let i = 0; i < this.providerOrder.length; i++) {
      const providerName = this.providerOrder[i];
      const providerStats = stats.providers.get(providerName);
      const isSelected = i === this.selectedIndex;
      const isExpanded = this.expanded.has(providerName);

      const arrow = isExpanded ? "▾" : "▸";
      const prefix = isSelected
        ? th.fg("accent", `${arrow} `)
        : th.fg("dim", `${arrow} `);
      if (providerStats) {
        const dataRow = this.renderDataRow(providerName, providerStats, {
          indent: 2,
          selected: isSelected,
        });
        lines.push(prefix + dataRow.slice(2));

        if (isExpanded) {
          const modelLines = this.renderModelRows(providerStats);
          lines.push(...modelLines);
        }
      }
    }

    return lines;
  }

  private renderModelRows(providerStats: ProviderStats): string[] {
    const models = Array.from(providerStats.models.entries()).sort(
      (a, b) => b[1].cost - a[1].cost,
    );
    return models.map(([modelName, modelStats]) =>
      this.renderDataRow(modelName, modelStats, { indent: 4, dimAll: true }),
    );
  }

  private renderTotals(): string[] {
    const th = this.theme;
    const stats = this.data[this.activeTab];

    let totalRow = padRight(th.bold("Total"), NAME_COL_WIDTH);
    for (const col of DATA_COLUMNS) {
      const value = col.getValue(stats.totals);
      totalRow += col.dimmed
        ? th.fg("dim", padLeft(value, col.width))
        : padLeft(value, col.width);
    }

    return [th.fg("border", "─".repeat(TABLE_WIDTH)), totalRow, ""];
  }

  private renderHelp(): string[] {
    return [
      this.theme.fg(
        "dim",
        "[Tab/←→] period  [↑↓] select  [Enter] expand  [q] close",
      ),
    ];
  }
}
