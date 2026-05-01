import { describe, it, expect } from "vitest";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { ToolUsageComponent } from "./component";

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

describe("tool-usage component rendering", () => {
  it("renders tool usage dashboard with per-tool stats", () => {
    const theme = createMockTheme();
    const data = {
      totalSessions: 5,
      totalToolCalls: 66,
      byTool: { read: 15, bash: 25, grep: 8, edit: 12, write: 6 },
      byDate: {},
      bySession: {},
    };
    const component = new ToolUsageComponent(
      theme,
      data as any,
      () => {},
      () => {},
    );
    const lines = component.render();
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("renders empty tool usage when no tools", () => {
    const theme = createMockTheme();
    const data = { byTool: {}, byDate: {}, bySession: {} };
    const component = new ToolUsageComponent(
      theme,
      data as any,
      () => {},
      () => {},
    );
    const lines = component.render();
    expect(lines.join("\n")).toMatchSnapshot();
  });
});
