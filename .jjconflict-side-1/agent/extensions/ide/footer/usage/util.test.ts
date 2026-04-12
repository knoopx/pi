import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatRemainingDuration,
  createRateLimitProcessor,
  loadTokenFromPiAuthJson,
  createGenericProvider,
} from "./util";
import type { BaseDependencies, ProviderConfig } from "./types";

describe("formatRemainingDuration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("given undefined reset time", () => {
    describe("when formatting", () => {
      it("then returns undefined", () => {
        expect(formatRemainingDuration(undefined)).toBeUndefined();
      });
    });
  });

  describe("given reset time in the past", () => {
    describe("when formatting", () => {
      it("then returns 'resetting...'", () => {
        const now = new Date("2024-01-15T12:00:00Z");
        vi.setSystemTime(now);

        const pastTime = "2024-01-15T11:00:00Z";
        expect(formatRemainingDuration(pastTime)).toBe("resetting...");
      });
    });
  });

  describe("given reset time in minutes", () => {
    describe("when less than an hour away", () => {
      it("then returns minutes format", () => {
        const now = new Date("2024-01-15T12:00:00Z");
        vi.setSystemTime(now);

        const resetTime = "2024-01-15T12:30:00Z";
        expect(formatRemainingDuration(resetTime)).toBe("30m");
      });
    });
  });

  describe("given reset time in hours", () => {
    describe("when less than a day away", () => {
      it("then returns hours and minutes format", () => {
        const now = new Date("2024-01-15T12:00:00Z");
        vi.setSystemTime(now);

        const resetTime = "2024-01-15T14:30:00Z";
        expect(formatRemainingDuration(resetTime)).toBe("2h 30m");
      });
    });
  });

  describe("given reset time in days", () => {
    describe("when more than a day away", () => {
      it("then returns days and hours format", () => {
        const now = new Date("2024-01-15T12:00:00Z");
        vi.setSystemTime(now);

        const resetTime = "2024-01-17T18:00:00Z";
        expect(formatRemainingDuration(resetTime)).toBe("2d 6h");
      });
    });
  });

  describe("given unix timestamp (seconds)", () => {
    describe("when formatting", () => {
      it("then converts correctly", () => {
        const now = new Date("2024-01-15T12:00:00Z");
        vi.setSystemTime(now);

        // Unix timestamp for 2024-01-15T13:00:00Z
        const resetTimestamp = Math.floor(
          new Date("2024-01-15T13:00:00Z").getTime() / 1000,
        );
        expect(formatRemainingDuration(resetTimestamp)).toBe("1h 0m");
      });
    });
  });
});

describe("createRateLimitProcessor", () => {
  describe("given window configuration", () => {
    describe("when processing data with matching paths", () => {
      it("then extracts rate limit windows", () => {
        const windows = [
          {
            path: "rate_limit.primary",
            label: "Primary",
            usedPercentPath: "used_percent",
          },
        ];

        const processor = createRateLimitProcessor(windows);
        const data = {
          rate_limit: {
            primary: {
              used_percent: 45.5,
            },
          },
        };

        const result = processor(data);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          label: "Primary",
          usedPercent: 45.5,
          resetDescription: undefined,
        });
      });
    });

    describe("when path does not exist", () => {
      it("then skips the window", () => {
        const windows = [{ path: "missing.path", label: "Missing" }];

        const processor = createRateLimitProcessor(windows);
        const data = { other: {} };

        const result = processor(data);
        expect(result).toHaveLength(0);
      });
    });

    describe("when label is a function", () => {
      it("then calls function with data and windowData", () => {
        const windows = [
          {
            path: "window",
            label: (_data: unknown, windowData: unknown) => {
              const wd = windowData as { hours: number };
              return `${wd.hours}h`;
            },
          },
        ];

        const processor = createRateLimitProcessor(windows);
        const data = {
          window: {
            hours: 5,
            utilization: 30,
          },
        };

        const result = processor(data);
        expect(result[0]?.label).toBe("5h");
      });
    });

    describe("when usedPercentTransform is provided", () => {
      it("then transforms the percentage", () => {
        const windows = [
          {
            path: "window",
            label: "Test",
            usedPercentPath: "ratio",
            usedPercentTransform: (val: number) => val * 100,
          },
        ];

        const processor = createRateLimitProcessor(windows);
        const data = { window: { ratio: 0.75 } };

        const result = processor(data);
        expect(result[0]?.usedPercent).toBe(75);
      });
    });

    describe("when reset path is absolute", () => {
      it("then resolves from root data", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));

        const windows = [
          {
            path: "window",
            label: "Test",
            resetPath: "/global_reset",
          },
        ];

        const processor = createRateLimitProcessor(windows);
        const data = {
          global_reset: "2024-01-15T13:00:00Z",
          window: { utilization: 50 },
        };

        const result = processor(data);
        expect(result[0]?.resetDescription).toBe("1h 0m");

        vi.useRealTimers();
      });
    });

    describe("when reset path is relative", () => {
      it("then resolves from window data", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-15T12:00:00Z"));

        const windows = [
          {
            path: "window",
            label: "Test",
            resetPath: "reset_time",
          },
        ];

        const processor = createRateLimitProcessor(windows);
        const data = {
          window: {
            utilization: 50,
            reset_time: "2024-01-15T12:30:00Z",
          },
        };

        const result = processor(data);
        expect(result[0]?.resetDescription).toBe("30m");

        vi.useRealTimers();
      });
    });
  });
});

describe("loadTokenFromPiAuthJson", () => {
  describe("given auth.json exists with token", () => {
    describe("when loading token", () => {
      it("then returns access token", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () =>
            JSON.stringify({
              anthropic: { access: "test-token-123" },
            }),
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(mockDeps, "anthropic");
        expect(token).toBe("test-token-123");
      });

      it("then falls back to refresh token", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () =>
            JSON.stringify({
              anthropic: { refresh: "refresh-token" },
            }),
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(mockDeps, "anthropic");
        expect(token).toBe("refresh-token");
      });
    });
  });

  describe("given auth.json does not exist", () => {
    describe("when loading token", () => {
      it("then returns undefined", () => {
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
  });

  describe("given custom token selector", () => {
    describe("when loading token", () => {
      it("then uses selector", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () =>
            JSON.stringify({
              custom: { nested: { key: "nested-token" } },
            }),
          fetch: vi.fn(),
        };

        const token = loadTokenFromPiAuthJson(mockDeps, "custom", (data) => {
          const d = data as { nested?: { key?: string } };
          return d.nested?.key;
        });
        expect(token).toBe("nested-token");
      });
    });
  });

  describe("given invalid JSON", () => {
    describe("when loading token", () => {
      it("then throws error", () => {
        const mockDeps: BaseDependencies = {
          homedir: () => "/home/user",
          fileExists: () => true,
          readFile: () => "invalid json",
          fetch: vi.fn(),
        };

        expect(() => loadTokenFromPiAuthJson(mockDeps, "anthropic")).toThrow();
      });
    });
  });
});

describe("createGenericProvider", () => {
  describe("given provider config", () => {
    const createMockDeps = (
      token: string | undefined,
      fetchResult: { ok: boolean; status: number; data: unknown } | "error",
    ): BaseDependencies => ({
      homedir: () => "/home/user",
      fileExists: () => !!token,
      readFile: () =>
        token ? JSON.stringify({ test: { access: token } }) : undefined,
      fetch: vi.fn().mockImplementation(async () => {
        if (fetchResult === "error") throw new Error("Network error");
        return {
          ok: fetchResult.ok,
          status: fetchResult.status,
          json: async () => fetchResult.data,
        };
      }),
    });

    const config: ProviderConfig = {
      provider: "test",
      displayName: "Test Provider",
      tokenLoader: (deps) => loadTokenFromPiAuthJson(deps, "test"),
      apiUrl: "https://api.test.com/usage",
      headers: (token) => ({ Authorization: `Bearer ${token}` }),
      windows: [
        {
          path: "usage",
          label: "Usage",
          usedPercentPath: "percent",
        },
      ],
    };

    describe("when no credentials found", () => {
      it("then returns auth error snapshot", async () => {
        const deps = createMockDeps(undefined, {
          ok: true,
          status: 200,
          data: {},
        });
        const fetchUsage = await createGenericProvider(config);
        const result = await fetchUsage(deps);

        expect(result).toEqual({
          provider: "test",
          displayName: "Test Provider",
          windows: [],
          error: "No credentials found",
        });
      });
    });

    describe("when API returns HTTP error", () => {
      it("then returns HTTP error snapshot", async () => {
        const deps = createMockDeps("token", {
          ok: false,
          status: 401,
          data: {},
        });
        const fetchUsage = await createGenericProvider(config);
        const result = await fetchUsage(deps);

        expect(result?.error).toBe("HTTP 401: Unauthorized");
      });
    });

    describe("when network error occurs", () => {
      it("then returns network error snapshot", async () => {
        const deps = createMockDeps("token", "error");
        const fetchUsage = await createGenericProvider(config);
        const result = await fetchUsage(deps);

        expect(result?.error).toBe("Network error");
      });
    });

    describe("when API returns successful data", () => {
      it("then returns usage snapshot with windows", async () => {
        const deps = createMockDeps("token", {
          ok: true,
          status: 200,
          data: { usage: { percent: 42 } },
        });
        const fetchUsage = await createGenericProvider(config);
        const result = await fetchUsage(deps);

        expect(result).toEqual({
          provider: "test",
          displayName: "Test Provider",
          windows: [
            { label: "Usage", usedPercent: 42, resetDescription: undefined },
          ],
        });
      });
    });

    describe("when custom processor is provided", () => {
      it("then uses custom processor", async () => {
        const customConfig: ProviderConfig = {
          ...config,
          windows: undefined,
          customProcessor: () => [{ label: "Custom", usedPercent: 99 }],
        };

        const deps = createMockDeps("token", {
          ok: true,
          status: 200,
          data: {},
        });
        const fetchUsage = await createGenericProvider(customConfig);
        const result = await fetchUsage(deps);

        expect(result?.windows).toEqual([{ label: "Custom", usedPercent: 99 }]);
      });
    });
  });
});
