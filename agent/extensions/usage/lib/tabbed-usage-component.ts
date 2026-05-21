import type { Theme } from "@earendil-works/pi-coding-agent";
import { formatNumber } from "../stats/formatting";
import { formatTabBar } from "./tab-bar";
import { KeyId, matchesKey } from "@earendil-works/pi-tui";

export type TabName = "total" | "session";

const TAB_ORDER: TabName[] = ["session", "total"];
const TAB_LABELS: Record<TabName, string> = {
  total: "All Sessions",
  session: "Current Session",
};

interface UsageComponentConfig<TData> {
  title: string;
  metricLabel: string;
  getMetricCount: (data: TData) => number;
}

interface ViewComponent {
  render(): string[];
}

interface SessionViewComponent extends ViewComponent {
  navigateUp(): void;
  navigateDown(): void;
  toggleExpand(): void;
}

abstract class TabbedUsageComponent<
  TData extends { totalSessions: number },
  TTotalView extends ViewComponent,
  TSessionView extends SessionViewComponent,
> {
  protected theme: Theme;
  protected data: TData;
  protected totalView: TTotalView;
  protected sessionView: TSessionView;
  activeTab: TabName = "session";

  private config: UsageComponentConfig<TData>;

  constructor(
    theme: Theme,
    data: TData,
    config: UsageComponentConfig<TData>,
    totalView: TTotalView,
    sessionView: TSessionView,
  ) {
    this.theme = theme;
    this.data = data;
    this.config = config;
    this.totalView = totalView;
    this.sessionView = sessionView;
  }

  handleInput(data: string): void {
    const normalized = data.toLowerCase();
    const matches = (key: KeyId) => matchesKey(data, key) || normalized === key;

    if (matches("escape") || matches("q")) return;

    for (const action of this.buildActions(matches)) {
      if (action.keys.some(matches)) {
        action.handler();
        return;
      }
    }
  }

  private buildActions(
    _matches: (key: KeyId) => boolean,
  ): { keys: KeyId[]; handler: () => void }[] {
    const actions: { keys: KeyId[]; handler: () => void }[] = [
      {
        keys: ["tab", "right"],
        handler: () => this.cycleTab(1),
      },
      {
        keys: ["shift+tab", "left"],
        handler: () => this.cycleTab(-1),
      },
    ];

    if (this.activeTab === "session") {
      actions.push(
        { keys: ["up"], handler: () => this.sessionView.navigateUp() },
        {
          keys: ["down"],
          handler: () => this.sessionView.navigateDown(),
        },
        {
          keys: ["enter", "space"],
          handler: () => this.sessionView.toggleExpand(),
        },
      );
    }

    return actions;
  }

  private cycleTab(direction: number): void {
    const idx = TAB_ORDER.indexOf(this.activeTab);
    const newIdx = (idx + direction + TAB_ORDER.length) % TAB_ORDER.length;
    this.activeTab = TAB_ORDER[newIdx];
  }

  render(): string[] {
    const th = this.theme;
    const lines: string[] = [
      th.fg("accent", th.bold(this.config.title)),
      `Sessions: ${formatNumber(this.data.totalSessions)}  |  ${this.config.metricLabel}: ${formatNumber(this.config.getMetricCount(this.data))}`,
      "",
      ...this.renderTabs(),
      "",
    ];

    if (this.activeTab === "total") {
      lines.push(...this.totalView.render());
    } else {
      lines.push(...this.sessionView.render());
    }

    lines.push("", this.renderHelp());
    return lines;
  }

  private renderTabs(): string[] {
    return [formatTabBar(TAB_ORDER, TAB_LABELS, this.activeTab, this.theme)];
  }

  private renderHelp(): string {
    const th = this.theme;
    if (this.activeTab === "session") {
      return th.fg(
        "dim",
        "[Tab/←→] switch tab  [↑↓] cycle sessions  [q] close",
      );
    }
    return th.fg("dim", "[Tab/←→] switch tab  [q] close");
  }
}

export { TabbedUsageComponent };
