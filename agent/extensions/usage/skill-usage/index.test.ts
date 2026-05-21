import { describe, it, expect } from "vitest";
import { createMockTheme } from "../lib/test-factories";
import { collectSkillStats } from "./data-collection";
import { SkillUsageComponent } from "./component";

describe("skill-usage", () => {
  describe("collectSkillStats", () => {
    it("then returns null when signal is aborted immediately", async () => {
      const controller = new AbortController();
      controller.abort();
      const result = await collectSkillStats(controller.signal);
      expect(result).toBeNull();
    });
  });

  describe("SkillUsageComponent", () => {
    it("then renders without crashing", () => {
      const theme = createMockTheme();
      const data = {
        totalSessions: 0,
        totalSkillCalls: 0,
        bySkill: {},
        bySession: {},
        byDate: {},
      };
      const component = new SkillUsageComponent(theme, data);
      const lines = component.render();
      expect(lines).toBeInstanceOf(Array);
    });
  });
});
