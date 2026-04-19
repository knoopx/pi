import { describe, it, expect } from "vitest";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { collectToolStats } from "./tool-usage/data-collection";
import { ToolUsageComponent } from "./tool-usage/component";

describe("tool-usage", () => {
  // Tool usage component tests would go here.
  // Currently untested: the data collection path for tool calls
  // requires real session files on disk.
  describe("collectToolStats", () => {
    it("then returns null when signal is aborted immediately", async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await collectToolStats(controller.signal);
      expect(result).toBeNull();
    });
  });

  describe("ToolUsageComponent", () => {
    it("then renders without crashing", () => {
      const theme = {
        fg(_color: string, text: string) {
          return text;
        },
        bold(text: string) {
          return text;
        },
      } as Theme;
      const data = {
        totalSessions: 0,
        totalToolCalls: 0,
        byTool: {},
        bySession: {},
        byDate: {},
      };
      const component = new ToolUsageComponent(
        theme,
        data,
        () => {},
        () => {},
      );
      const lines = component.render();
      expect(lines).toBeInstanceOf(Array);
    });
  });
});
