import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatRemainingDuration,
  createRateLimitProcessor,
  loadTokenFromPiAuthJson,
} from "./util";
import type { BaseDependencies } from "./types";

describe("Quotas Utilities", () => {
  describe("formatRemainingDuration", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-07T00:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("given undefined input", () => {
      it("then it should return undefined", () => {
        expect(formatRemainingDuration(undefined)).toBeUndefined();
      });
    });

    describe("given a past date", () => {
      it("then it should return 'resetting...'", () => {
        const pastDate = "2026-02-06T00:00:00Z";
        expect(formatRemainingDuration(pastDate)).toBe("resetting...");
      });
    });

    describe("given a date several days in the future", () => {
      it("then it should return days and hours format", () => {
        const futureDate = "2026-02-10T12:00:00Z";
        expect(formatRemainingDuration(futureDate)).toBe("3d 12h");
      });
    });

    describe("given a date several hours in the future", () => {
      it("then it should return hours and minutes format", () => {
        const futureDate = "2026-02-07T05:30:00Z";
        expect(formatRemainingDuration(futureDate)).toBe("5h 30m");
      });
    });

    describe("given a date less than an hour in the future", () => {
      it("then it should return minutes format", () => {
        const futureDate = "2026-02-07T00:45:00Z";
        expect(formatRemainingDuration(futureDate)).toBe("45m");
      });
    });

    describe("given a Unix timestamp", () => {
      it("then it should parse it correctly", () => {
        // 2026-02-08T00:00:00Z as Unix timestamp
        const timestamp = Math.floor(
          new Date("2026-02-08T00:00:00Z").getTime() / 1000,
        );
        expect(formatRemainingDuration(timestamp)).toBe("1d 0h");
      });
    });
  });

  describe("createRateLimitProcessor", () => {
    describe("given empty windows configuration", () => {
      it("then it should return empty array", () => {
        const processor = createRateLimitProcessor([]);
        expect(processor({})).toEqual([]);
      });
    });

    describe("given a simple window configuration", () => {
      it("then it should extract utilization from data", () => {
        const processor = createRateLimitProcessor([
          { path: "rate_limit", label: "Rate Limit" },
        ]);

        const data = {
          rate_limit: {
            utilization: 75,
          },
        };

        const result = processor(data);
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("Rate Limit");
        expect(result[0].usedPercent).toBe(75);
      });
    });

    describe("given a window with custom usedPercent path", () => {
      it("then it should extract value from specified path", () => {
        const processor = createRateLimitProcessor([
          {
            path: "quota",
            label: "Quota",
            usedPercentPath: "usage.percent",
          },
        ]);

        const data = {
          quota: {
            usage: { percent: 42 },
          },
        };

        const result = processor(data);
        expect(result[0].usedPercent).toBe(42);
      });
    });

    describe("given a window with usedPercent transform", () => {
      it("then it should apply the transform function", () => {
        const processor = createRateLimitProcessor([
          {
            path: "limit",
            label: "Limit",
            usedPercentTransform: (val) => val * 100,
          },
        ]);

        const data = {
          limit: {
            utilization: 0.5,
          },
        };

        const result = processor(data);
        expect(result[0].usedPercent).toBe(50);
      });
    });

    describe("given a window with dynamic label", () => {
      it("then it should call the label function", () => {
        const processor = createRateLimitProcessor([
          {
            path: "tier",
            label: (_data, windowData) =>
              `Tier: ${(windowData as { name: string }).name}`,
          },
        ]);

        const data = {
          tier: {
            name: "Premium",
            utilization: 30,
          },
        };

        const result = processor(data);
        expect(result[0].label).toBe("Tier: Premium");
      });
    });

    describe("given a window with reset path", () => {
      it("then it should include reset description", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-07T00:00:00Z"));

        const processor = createRateLimitProcessor([
          {
            path: "window",
            label: "Window",
            resetPath: "resets_at",
          },
        ]);

        const data = {
          window: {
            utilization: 50,
            resets_at: "2026-02-07T02:00:00Z",
          },
        };

        const result = processor(data);
        expect(result[0].resetDescription).toBe("2h 0m");

        vi.useRealTimers();
      });
    });

    describe("given a window with absolute reset path", () => {
      it("then it should read from root data", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-07T00:00:00Z"));

        const processor = createRateLimitProcessor([
          {
            path: "window",
            label: "Window",
            resetPath: "/global_reset",
          },
        ]);

        const data = {
          window: { utilization: 25 },
          global_reset: "2026-02-08T00:00:00Z",
        };

        const result = processor(data);
        expect(result[0].resetDescription).toBe("1d 0h");

        vi.useRealTimers();
      });
    });

    describe("given a missing window in data", () => {
      it("then it should skip that window", () => {
        const processor = createRateLimitProcessor([
          { path: "missing", label: "Missing" },
          { path: "present", label: "Present" },
        ]);

        const data = {
          present: { utilization: 60 },
        };

        const result = processor(data);
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe("Present");
      });
    });
  });

  describe("loadTokenFromPiAuthJson", () => {
    describe("given auth.json exists with access token", () => {
      it("then it should return the access token", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () =>
            JSON.stringify({
              anthropic: { access: "sk-test-token" },
            }),
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(mockDeps, "anthropic");
        expect(token).toBe("sk-test-token");
      });
    });

    describe("given auth.json exists with refresh token only", () => {
      it("then it should return the refresh token", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () =>
            JSON.stringify({
              openai: { refresh: "refresh-token" },
            }),
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(mockDeps, "openai");
        expect(token).toBe("refresh-token");
      });
    });

    describe("given auth.json does not exist", () => {
      it("then it should return undefined", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => false,
          readFile: () => undefined,
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(mockDeps, "anthropic");
        expect(token).toBeUndefined();
      });
    });

    describe("given auth.json has invalid JSON", () => {
      it("then it should return undefined", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () => "invalid json",
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(mockDeps, "anthropic");
        expect(token).toBeUndefined();
      });
    });

    describe("given a custom token selector", () => {
      it("then it should use the selector function", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () =>
            JSON.stringify({
              custom: { nested: { key: "custom-token" } },
            }),
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(
          mockDeps,
          "custom",
          (data) => (data.custom as { nested: { key: string } })?.nested?.key,
        );
        expect(token).toBe("custom-token");
      });
    });

    describe("given provider key not in auth.json", () => {
      it("then it should return undefined", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () => JSON.stringify({ other: { access: "token" } }),
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(mockDeps, "anthropic");
        expect(token).toBeUndefined();
      });
    });
  });
});
