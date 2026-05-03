import type { AgentWorkspace } from "./types";
import { describe, it, expect } from "vitest";
import { formatFileStats, formatRelativeTime } from "./formatters";

describe("formatFileStats", () => {
  describe("given a workspace with no file stats", () => {
    it("then returns an empty string", () => {
      expect(
        formatFileStats({
          name: "test",
          path: "/",
          description: "",
          status: "idle",
          changeId: "",
          parentChangeId: "",
          createdAt: 0,
        }),
      ).toBe("");
    });
  });

  describe("given a workspace with only additions", () => {
    it("then returns +count", () => {
      const ws: AgentWorkspace = {
        name: "test",
        path: "/",
        description: "",
        status: "idle" as const,
        changeId: "",
        parentChangeId: "",
        createdAt: 0,
        fileStats: { added: 3, modified: 0, deleted: 0 },
      };
      expect(formatFileStats(ws)).toBe("[+3]");
    });
  });

  describe("given a workspace with only modifications", () => {
    it("then returns ~count", () => {
      const ws: AgentWorkspace = {
        name: "test",
        path: "/",
        description: "",
        status: "idle" as const,
        changeId: "",
        parentChangeId: "",
        createdAt: 0,
        fileStats: { added: 0, modified: 2, deleted: 0 },
      };
      expect(formatFileStats(ws)).toBe("[~2]");
    });
  });

  describe("given a workspace with only deletions", () => {
    it("then returns -count", () => {
      const ws: AgentWorkspace = {
        name: "test",
        path: "/",
        description: "",
        status: "idle" as const,
        changeId: "",
        parentChangeId: "",
        createdAt: 0,
        fileStats: { added: 0, modified: 0, deleted: 5 },
      };
      expect(formatFileStats(ws)).toBe("[-5]");
    });
  });

  describe("given a workspace with all stats", () => {
    it("then returns all three parts in order", () => {
      const ws: AgentWorkspace = {
        name: "test",
        path: "/",
        description: "",
        status: "idle" as const,
        changeId: "",
        parentChangeId: "",
        createdAt: 0,
        fileStats: { added: 1, modified: 2, deleted: 3 },
      };
      expect(formatFileStats(ws)).toBe("[+1 ~2 -3]");
    });
  });

  describe("given a workspace with zero counts", () => {
    it("then returns an empty string", () => {
      const ws: AgentWorkspace = {
        name: "test",
        path: "/",
        description: "",
        status: "idle" as const,
        changeId: "",
        parentChangeId: "",
        createdAt: 0,
        fileStats: { added: 0, modified: 0, deleted: 0 },
      };
      expect(formatFileStats(ws)).toBe("");
    });
  });
});

describe("formatRelativeTime", () => {
  describe("given a time less than an hour ago", () => {
    it("then returns minutes ago", () => {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60_000);
      expect(formatRelativeTime(fiveMinAgo.toISOString())).toBe("5m ago");
    });

    it("then returns 0m ago for the current time", () => {
      const now = new Date();
      expect(formatRelativeTime(now.toISOString())).toBe("0m ago");
    });
  });

  describe("given a time between 1 and 23 hours ago", () => {
    it("then returns hours ago", () => {
      const now = new Date();
      const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60_000);
      expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe("3h ago");
    });

    it("then returns 1h ago for one hour ago", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60_000);
      expect(formatRelativeTime(oneHourAgo.toISOString())).toBe("1h ago");
    });
  });

  describe("given a time between 1 and 29 days ago", () => {
    it("then returns days ago", () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60_000);
      expect(formatRelativeTime(fiveDaysAgo.toISOString())).toBe("5d ago");
    });

    it("then returns 1d ago for one day ago", () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60_000);
      expect(formatRelativeTime(oneDayAgo.toISOString())).toBe("1d ago");
    });
  });

  describe("given a time 30 or more days ago", () => {
    it("then returns the locale date string", () => {
      const now = new Date();
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60_000);
      const result = formatRelativeTime(twoMonthsAgo.toISOString());
      expect(result).not.toContain("d ago");
      expect(result).toContain("/");
    });
  });
});
