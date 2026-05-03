import type { Theme } from "@mariozechner/pi-coding-agent";
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

function renderHistoryRow(
  entry: HistoryEntry,
  isSelected: boolean,
  width: number,
  theme: Theme,
): string {
  const typeIndicator = entry.type === "command" ? "󰅩" : "󰈚";
  const typeColor = entry.type === "command" ? "success" : "accent";
  const displayContent = truncateSingleLine(
    entry.preview ?? entry.content,
    width - 2,
  );

  if (isSelected) {
    const coloredIndicator = theme.fg(typeColor, typeIndicator);
    const contentColored = theme.fg(typeColor, displayContent);
    return theme.bg("selectedBg", `${coloredIndicator} ${contentColored}`);
  }

  const coloredIndicator = theme.fg(typeColor, typeIndicator);
  return pad(`${coloredIndicator} ${displayContent}`, width);
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
