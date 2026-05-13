import type { Theme } from "@earendil-works/pi-coding-agent";
import { pad } from "../ide/lib/text-utils";

interface HistoryEntry {
  content: string;
  preview?: string;
  timestamp: number;
  type: "command" | "message";
}

function truncateSingleLine(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.slice(0, maxWidth - 1) + "\u2026";
}

function getEntryTypeStyle(entry: HistoryEntry): {
  icon: string;
  color: "success" | "accent";
} {
  if (entry.type === "command") return { icon: "󰅩", color: "success" };
  return { icon: "󰈚", color: "accent" };
}

function renderHistoryRow(
  entry: HistoryEntry,
  isSelected: boolean,
  width: number,
  theme: Theme,
): string {
  const { icon, color } = getEntryTypeStyle(entry);
  const displayContent = truncateSingleLine(
    entry.preview ?? entry.content,
    width - 2,
  );
  const coloredIndicator = theme.fg(color, icon);
  const contentColored = theme.fg(color, displayContent);
  const rowText = `${coloredIndicator} ${contentColored}`;

  if (isSelected) return theme.bg("selectedBg", rowText);
  return pad(rowText, width);
}

export function renderHistoryPage(
  filtered: HistoryEntry[],
  selectedIndex: number,
  width: number,
  query: string | undefined,
  theme: Theme,
  filterName?: string,
): string[] {
  const lines: string[] = [];
  const borderChar = theme.fg("accent", "\u2500");

  lines.push(borderChar.repeat(width));

  const maxVisible = 10;
  const start = Math.max(
    0,
    Math.min(selectedIndex - 4, filtered.length - maxVisible),
  );
  const end = Math.min(start + maxVisible, filtered.length);
  const queryPart = query ? `${query} \u2022 ` : "";
  const pagerPart = `[${start + 1}-${end} of ${filtered.length}]`;
  const filterPart = filterName ? `${filterName} • ` : "";
  lines.push(theme.fg("dim", `${filterPart}${queryPart}${pagerPart}`));

  for (let i = start; i < end; i++) {
    lines.push(
      renderHistoryRow(filtered[i], i === selectedIndex, width, theme),
    );
  }

  lines.push(borderChar.repeat(width));
  return lines;
}
