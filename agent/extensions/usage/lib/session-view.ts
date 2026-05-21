import type { Theme } from "@earendil-works/pi-coding-agent";
import { formatBarRow } from "./bar-chart";

interface SessionViewConfig {
  getSessions: (data: unknown) => [string, { count: number } & object][];
  getDetails: (entry: object) => Record<string, number>;
}

class SessionView {
  private theme: Theme;
  private data: unknown;
  private config: SessionViewConfig;
  selectedIndex = 0;

  constructor(theme: Theme, data: unknown, config: SessionViewConfig) {
    this.theme = theme;
    this.data = data;
    this.config = config;
  }

  private get sessions(): [string, { count: number } & object][] {
    return this.config.getSessions(this.data);
  }

  navigateUp(): void {
    const sessions = this.sessions;
    if (sessions.length === 0) return;
    this.selectedIndex =
      (this.selectedIndex - 1 + sessions.length) % sessions.length;
  }

  navigateDown(): void {
    const sessions = this.sessions;
    if (sessions.length === 0) return;
    this.selectedIndex = (this.selectedIndex + 1) % sessions.length;
  }

  toggleExpand(): void {
    // No-op: session view does not support expand/collapse
  }

  render(): string[] {
    const sessions = this.sessions;

    if (sessions.length === 0) {
      return [this.theme.fg("dim", "  No session data")];
    }

    const [, entry] = sessions[this.selectedIndex];
    const details = this.config.getDetails(entry);
    const items = Object.entries(details).sort(([, a], [, b]) => b - a);

    if (items.length === 0) {
      return [this.theme.fg("dim", "  No data for this session")];
    }

    const th = this.theme;
    const maxNameLen = Math.max(...items.map(([n]) => n.length), 10);
    const maxCount = items[0][1];
    const totalCalls = items.reduce((s, [, c]) => s + c, 0);

    return [
      th.fg(
        "muted",
        `${this.selectedIndex + 1} / ${sessions.length} sessions  |  ${totalCalls} calls`,
      ),
      "",
      ...items.map(([name, count]) =>
        formatBarRow(name, count, maxNameLen, maxCount, totalCalls, th),
      ),
    ];
  }
}

export { SessionView };
export type { SessionViewConfig };
