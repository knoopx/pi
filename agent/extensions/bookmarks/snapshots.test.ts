/**
 * Snapshot tests for Bookmarks tool output formatting.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { formatFirefoxDate } from "./index";
import { createMockExtensionAPI } from "../../shared/test-utils";
import type { MockExtensionAPI, MockTool } from "../../shared/test-utils";

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

vi.mock("better-sqlite3", () => ({ default: vi.fn() }));
vi.mock("fs/promises", () => ({
  access: vi.fn(),
  copyFile: vi.fn(),
  unlink: vi.fn(),
}));

describe("bookmarks output snapshots", () => {
  describe("formatFirefoxDate", () => {
    it("renders a date from Firefox microsecond timestamp", () => {
      // 2026-03-08T00:00:00Z in microseconds
      const ts = new Date("2026-03-08T00:00:00Z").getTime() * 1000;
      expect(formatFirefoxDate(ts)).toBe("2026-03-08");
    });
  });

  describe("tool output", () => {
    let mockPi: MockExtensionAPI;
    let bookmarksTool: MockTool;
    let historyTool: MockTool;

    beforeEach(async () => {
      mockPi = createMockExtensionAPI();
      const { default: ext } = await import("./index");
      ext(mockPi as ExtensionAPI);

      bookmarksTool = mockPi.registerTool.mock.calls.find(
        (c) => c[0].name === "firefox-bookmarks",
      )![0] as MockTool;
      historyTool = mockPi.registerTool.mock.calls.find(
        (c) => c[0].name === "firefox-history",
      )![0] as MockTool;
    });

    it("renders bookmarks with results", async () => {
      const fs = await import("fs/promises");
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.copyFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.unlink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const sqlite3 = await import("better-sqlite3");
      const mockAll = vi.fn().mockReturnValue([
        {
          id: 1,
          url: "https://github.com",
          title: "GitHub",
          dateAdded: new Date("2026-01-15").getTime() * 1000,
        },
        {
          id: 2,
          url: "https://nixos.org",
          title: "NixOS",
          dateAdded: new Date("2026-02-20").getTime() * 1000,
        },
      ]);
      (sqlite3.default as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        close: vi.fn(),
        pragma: vi.fn(),
      });

      const result = await bookmarksTool.execute(
        "id",
        { query: "", limit: 50 },
        undefined,
        undefined,
        {},
      );
      expect(
        stripAnsi((result.content[0] as { text: string }).text),
      ).toMatchSnapshot();
    });

    it("renders empty bookmarks", async () => {
      const fs = await import("fs/promises");
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.copyFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.unlink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const sqlite3 = await import("better-sqlite3");
      (sqlite3.default as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        prepare: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue([]) }),
        close: vi.fn(),
        pragma: vi.fn(),
      });

      const result = await bookmarksTool.execute(
        "id",
        { query: "nonexistent", limit: 50 },
        undefined,
        undefined,
        {},
      );
      expect((result.content[0] as { text: string }).text).toBe(
        "No bookmarks found",
      );
    });

    it("renders history with results", async () => {
      const fs = await import("fs/promises");
      (fs.access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.copyFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (fs.unlink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const sqlite3 = await import("better-sqlite3");
      const mockAll = vi.fn().mockReturnValue([
        {
          id: 1,
          url: "https://github.com/search",
          title: "GitHub Search",
          visitCount: 42,
          lastVisit: new Date("2026-03-07").getTime() * 1000,
        },
        {
          id: 2,
          url: "https://docs.rs",
          title: "Docs.rs",
          visitCount: 7,
          lastVisit: new Date("2026-03-06").getTime() * 1000,
        },
      ]);
      (sqlite3.default as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        close: vi.fn(),
        pragma: vi.fn(),
      });

      const result = await historyTool.execute(
        "id",
        { query: "", limit: 50 },
        undefined,
        undefined,
        {},
      );
      expect(
        stripAnsi((result.content[0] as { text: string }).text),
      ).toMatchSnapshot();
    });
  });
});
