import { describe, it, expect, vi, beforeEach } from "vitest";

import type { SearchContext7ParamsType } from "./types";

describe("searchContext7", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.mock("node:fs", () => ({
      readFileSync: vi
        .fn()
        .mockReturnValue(JSON.stringify({ context7: { key: "test-key" } })),
    }));
    vi.mock("node:path", () => ({
      join: (...args: string[]) => args.join("/"),
    }));
    vi.mock("node:os", () => ({
      homedir: () => "/home/test",
    }));
  });

  it("throws when API key is missing", async () => {
    vi.doMock("node:fs", () => ({
      readFileSync: vi.fn().mockReturnValue("{}"),
    }));
    vi.resetModules();
    const { searchContext7: search2 } = await import("./search");

    await expect(
      search2({ query: "test" } as SearchContext7ParamsType),
    ).rejects.toThrow("Context7 API key not set");
  });
});
