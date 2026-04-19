import { Container, Spacer } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";
import type { BaseStats } from "./types";
import { formatNumber, formatCost, formatTokens } from "./formatters";

interface DataColumn {
  label: string;
  width: number;
  dimmed?: boolean;
  getValue: (stats: BaseStats & { sessions: Set<string> | number }) => string;
}

export const NAME_COL_WIDTH = 26;

export const DATA_COLUMNS: DataColumn[] = [
  {
    label: "Sessions",
    width: 9,
    getValue: (s) =>
      formatNumber(
        typeof s.sessions === "number" ? s.sessions : s.sessions.size,
      ),
  },
  { label: "Msgs", width: 9, getValue: (s) => formatNumber(s.messages) },
  { label: "Cost", width: 9, getValue: (s) => formatCost(s.cost) },
  { label: "Tokens", width: 9, getValue: (s) => formatTokens(s.tokens.total) },
  {
    label: "↑In",
    width: 8,
    dimmed: true,
    getValue: (s) => formatTokens(s.tokens.input),
  },
  {
    label: "↓Out",
    width: 8,
    dimmed: true,
    getValue: (s) => formatTokens(s.tokens.output),
  },
  {
    label: "Cache",
    width: 8,
    dimmed: true,
    getValue: (s) => formatTokens(s.tokens.cache),
  },
];

export const TABLE_WIDTH =
  NAME_COL_WIDTH + DATA_COLUMNS.reduce((sum, col) => sum + col.width, 0);

export function createBorderedContainer(theme: Theme): Container {
  const container = new Container();
  container.addChild(new Spacer(1));
  container.addChild(new DynamicBorder((s: string) => theme.fg("border", s)));
  container.addChild(new Spacer(1));
  return container;
}
