import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockReaddir } from "../lib/test-factories";
import { collectSkillStats } from "./data-collection";

vi.mock("../stats/data-collection", () => ({
  getSessionsDir: () => "/home/test/.pi/agent/sessions",
}));

describe("collectSkillStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defined stats when sessions dir is empty", async () => {
    mockReaddir.mockImplementation(async (path: string) => {
      if (path.includes("sessions")) return [];
      return [];
    });

    const result = await collectSkillStats();
    expect(result).toBeDefined();
  });

  it("handles signal abort", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await collectSkillStats(controller.signal);
    expect(result).toBeDefined();
  });

  it("handles unreadable session files", async () => {
    mockReaddir.mockImplementation(async (path: string) => {
      if (path.includes("sessions")) return ["session-1"];
      if (path.includes("session-1")) return ["data.jsonl"];
      return [];
    });
    const result = await collectSkillStats();
    expect(result).toBeDefined();
  });
});
