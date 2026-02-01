import { describe, it, expect, vi } from "vitest";
import { loadGithubToken } from "./copilot";
import { fetchCopilotUsage } from "./copilot";

describe("GitHub Copilot Provider", () => {
  it("should load token correctly", () => {
    const mockDeps = {
      homedir: () => "/home/user",
      fileExists: vi.fn(() => true),
      readFile: vi.fn(() =>
        JSON.stringify({
          "github-copilot": {
            type: "oauth",
            refresh: "ghu_test_token",
            access: "test_access_token",
          },
        }),
      ),
      env: {},
      fetch: vi.fn(),
    };

    const token = loadGithubToken(mockDeps);
    expect(token).toBe("ghu_test_token"); // Should prefer refresh token
  });

  it("should handle missing auth data", () => {
    const mockDeps = {
      homedir: () => "/home/user",
      fileExists: vi.fn(() => false),
      readFile: vi.fn(() => "{}"),
      env: {},
      fetch: vi.fn(),
    };

    const token = loadGithubToken(mockDeps);
    expect(token).toBeUndefined();
  });

  it("should create auth error for missing token", async () => {
    const mockDeps = {
      homedir: () => "/home/user",
      fileExists: vi.fn(() => false),
      readFile: vi.fn(() => "{}"),
      env: {},
      fetch: vi.fn(),
    };

    const result = await fetchCopilotUsage(mockDeps);
    expect(result).toEqual({
      provider: "copilot",
      displayName: "GitHub Copilot",
      windows: [],
      error: "No credentials found",
    });
  });
});
