import { describe, it, expect } from "vitest";
import type { SkillStats } from "./types";
import { SkillUsageComponent } from "./component";
import { createMockTheme } from "../../../shared/testing/mock-theme";

function renderSkillUsage(data: SkillStats): string[] {
  const theme = createMockTheme();
  const component = new SkillUsageComponent(theme, data);
  return component.render();
}

describe("skill-usage component rendering", () => {
  it("renders skill usage dashboard with per-skill stats", () => {
    const lines = renderSkillUsage({
      totalSessions: 12,
      totalSkillCalls: 142,
      bySkill: {
        bash: 45,
        typescript: 38,
        vitest: 28,
        "barrel-files": 15,
        duckdb: 10,
        nix: 6,
      },
      byDate: {},
      bySession: {},
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("renders empty skill usage when no skills", () => {
    const lines = renderSkillUsage({
      totalSessions: 0,
      totalSkillCalls: 0,
      bySkill: {},
      byDate: {},
      bySession: {},
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("renders session tab with per-session breakdown", () => {
    const lines = renderSkillUsage({
      totalSessions: 3,
      totalSkillCalls: 24,
      bySkill: { bash: 15, duckdb: 9 },
      byDate: {},
      bySession: {
        "sess-aaa-111": { count: 12, skills: { bash: 8, duckdb: 4 } },
        "sess-bbb-222": { count: 8, skills: { bash: 5, duckdb: 3 } },
        "sess-ccc-333": { count: 4, skills: { bash: 2, duckdb: 2 } },
      },
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });
});
