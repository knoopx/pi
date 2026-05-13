import { describe, it, expect } from "vitest";
import type { ToolStats } from "./types";
import { ToolUsageComponent } from "./component";
import { createMockTheme } from "../../../shared/testing/mock-theme";

function renderToolUsage(data: ToolStats): string[] {
  const theme = createMockTheme();
  const component = new ToolUsageComponent(
    theme,
    data,
    () => {},
    () => {},
  );
  return component.render();
}

describe("tool-usage component rendering", () => {
  it("renders tool usage dashboard with per-tool stats", () => {
    const lines = renderToolUsage({
      totalSessions: 5,
      totalToolCalls: 66,
      byTool: { read: 15, bash: 25, grep: 8, edit: 12, write: 6 },
      byDate: {},
      bySession: {},
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("renders empty tool usage when no tools", () => {
    const lines = renderToolUsage({
      totalSessions: 0,
      totalToolCalls: 0,
      byTool: {},
      byDate: {},
      bySession: {},
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });
});
