import { describe, it, expect } from "vitest";
import type { HistoryEntry } from "./types";
import { createMockTheme } from "../../shared/testing/mock-theme";
import { renderHistoryPage } from "./ui/renderer";

function filterEntries(entries: HistoryEntry[], query: string): HistoryEntry[] {
  if (!query) return entries;
  const lower = query.toLowerCase();
  return entries.filter((e) => e.content.toLowerCase().includes(lower));
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
    const filtered = filterEntries(sampleEntries, "");
    const lines = renderHistoryPage(filtered, 0, 120, undefined, theme);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders history search results with query filter",
    );
  });

  it("renders filtered results matching query", () => {
    const filtered = filterEntries(sampleEntries, "bun");
    const lines = renderHistoryPage(filtered, 1, 120, "bun", theme);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders filtered results matching query",
    );
  });

  it("renders selected item with highlight indicator", () => {
    const filtered = filterEntries(sampleEntries, "");
    const lines = renderHistoryPage(filtered, 3, 120, undefined, theme);
    expect(lines.join("\n")).toMatchSnapshot(
      "renders selected item with highlight indicator",
    );
  });

  it("renders empty results when no matches", () => {
    const filtered = filterEntries(sampleEntries, "nonexistenttermxyz");
    const lines = renderHistoryPage(
      filtered,
      0,
      120,
      "nonexistenttermxyz",
      theme,
    );
    expect(lines.join("\n")).toMatchSnapshot(
      "renders empty results when no matches",
    );
  });

  it("renders at narrow width", () => {
    const filtered = filterEntries(sampleEntries, "");
    const lines = renderHistoryPage(filtered, 0, 80, undefined, theme);
    expect(lines.join("\n")).toMatchSnapshot("renders at narrow width");
  });
});
