import { describe, it, expect } from "vitest";
import type { Theme } from "@mariozechner/pi-coding-agent";

function createMockTheme(): Theme {
  return {
    name: "mock",
    fg: (color: string, text: string) => text,
    bg: (color: string, text: string) => text,
    bold: (t: string) => t,
    italic: (t: string) => t,
    underline: (t: string) => t,
    inverse: (t: string) => t,
    strikethrough: (t: string) => t,
  } as unknown as Theme;
}

interface HistoryEntry {
  content: string;
  preview?: string;
  timestamp: number;
  type: "command" | "message";
}

function truncateSingleLine(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.slice(0, maxWidth - 1) + "…";
}

function ensureWidth(text: string, width: number): string {
  return text.padEnd(width);
}

function renderHistorySearch(
  theme: Theme,
  entries: HistoryEntry[],
  query: string,
  selectedIndex: number,
  width: number,
): string[] {
  const lines: string[] = [];
  const borderChar = theme.fg("accent", "─");

  lines.push(borderChar.repeat(width));

  const maxVisible = 10;
  const filtered = entries.filter((e) => {
    if (!query) return true;
    return e.content.toLowerCase().includes(query.toLowerCase());
  });

  const start = Math.max(
    0,
    Math.min(selectedIndex - 4, filtered.length - maxVisible),
  );
  const end = Math.min(start + maxVisible, filtered.length);
  const queryPart = query ? `${query} • ` : "";
  const pagerPart = `[${start + 1}-${end} of ${filtered.length}]`;
  lines.push(theme.fg("dim", `${queryPart}${pagerPart}`));

  for (let i = start; i < end; i++) {
    const entry = filtered[i];
    const isSelected = i === selectedIndex;
    const typeIndicator = entry.type === "command" ? "$" : "󰆉";
    const typeColor = entry.type === "command" ? "success" : "accent";
    const displayContent = truncateSingleLine(
      entry.preview ?? entry.content,
      width - 2,
    );
    const content = `${typeIndicator} ${displayContent}`;
    const padded = ensureWidth(content, width);
    let line: string;
    if (isSelected) {
      const colored = theme.fg(typeColor, padded);
      line = theme.bg("selectedBg", colored);
    } else {
      const coloredIndicator = theme.fg(typeColor, typeIndicator);
      line = `${coloredIndicator} ${displayContent}`;
    }

    lines.push(line);
  }

  lines.push(borderChar.repeat(width));

  return lines;
}

describe("reverse-history-search — list row rendering", () => {
  const theme = createMockTheme();

  const sampleEntries: HistoryEntry[] = [
    {
      content: "bun run build",
      preview: "bun run build",
      timestamp: Date.now() - 60000,
      type: "command",
    },
    {
      content: "Fix the rendering issue in the split panel component",
      preview: "Fix the rendering issue in the split panel component",
      timestamp: Date.now() - 120000,
      type: "message",
    },
    {
      content: "cm map agent/extensions --level 2 --format ai",
      preview: "cm map agent/extensions --level 2 --format ai",
      timestamp: Date.now() - 180000,
      type: "command",
    },
    {
      content: "Update the README with new extension features",
      preview: "Update the README with new extension features",
      timestamp: Date.now() - 240000,
      type: "message",
    },
    {
      content: "jj log --no-graph",
      preview: "jj log --no-graph",
      timestamp: Date.now() - 300000,
      type: "command",
    },
    {
      content: "Can you help me debug this TypeScript error?",
      preview: "Can you help me debug this TypeScript error?",
      timestamp: Date.now() - 360000,
      type: "message",
    },
    {
      content: "bunx vitest run agent/extensions/ide/components/changes/",
      preview: "bunx vitest run agent/extensions/ide/components/changes/",
      timestamp: Date.now() - 420000,
      type: "command",
    },
    {
      content: "Add snapshot tests for all components",
      preview: "Add snapshot tests for all components",
      timestamp: Date.now() - 480000,
      type: "message",
    },
  ];

  it("renders history search results with query filter", () => {
    const lines = renderHistorySearch(theme, sampleEntries, "", 0, 120);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders history search results with query filter",
    );
  });

  it("renders filtered results matching query", () => {
    const lines = renderHistorySearch(theme, sampleEntries, "bun", 1, 120);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders filtered results matching query",
    );
  });

  it("renders selected item with highlight indicator", () => {
    const lines = renderHistorySearch(theme, sampleEntries, "", 3, 120);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders selected item with highlight indicator",
    );
  });

  it("renders empty results when no matches", () => {
    const lines = renderHistorySearch(
      theme,
      sampleEntries,
      "nonexistenttermxyz",
      0,
      120,
    );
    expect(lines.join("\n")).toMatchSnapshot(
      "renders empty results when no matches",
    );
  });

  it("renders at narrow width", () => {
    const lines = renderHistorySearch(theme, sampleEntries, "", 0, 80);
    expect(lines.join("\n")).toMatchSnapshot("renders at narrow width");
  });
});
