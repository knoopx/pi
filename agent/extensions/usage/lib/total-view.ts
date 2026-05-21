import type { Theme } from "@earendil-works/pi-coding-agent";
import { formatBarRow } from "./bar-chart";

interface TotalViewConfig {
  emptyMessage: string;
  getItemMap: (data: unknown) => Record<string, number>;
  getTotalCount: (data: unknown) => number;
  minNameWidth?: number;
}

class TotalView {
  private theme: Theme;
  private data: unknown;
  private config: TotalViewConfig;

  constructor(theme: Theme, data: unknown, config: TotalViewConfig) {
    this.theme = theme;
    this.data = data;
    this.config = config;
  }

  render(): string[] {
    const th = this.theme;
    const items = Object.entries(this.config.getItemMap(this.data))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);

    if (items.length === 0) {
      return [th.fg("dim", this.config.emptyMessage)];
    }

    const maxNameLen = Math.max(
      ...items.map(([name]) => name.length),
      this.config.minNameWidth ?? 10,
    );
    const total = this.config.getTotalCount(this.data);
    const maxCount = items[0][1];

    return items.map(([name, count]) =>
      formatBarRow(name, count, maxNameLen, maxCount, total, th),
    );
  }
}

export { TotalView };
export type { TotalViewConfig };
