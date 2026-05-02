import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stats } from "node:fs";
import { isCacheStale } from "../../shared/cache/cache-helpers";

const fsPromises = await import("node:fs/promises");

vi.mock("node:fs/promises", async () => {
  const actual =
    await vi.importActual<typeof import("node:fs/promises")>(
      "node:fs/promises",
    );
  return {
    ...actual,
    stat: vi.fn(),
  };
});

describe("isCacheStale", () => {
  describe("given new files not in the cache", () => {
    it("then it should return true because there are uncached files", async () => {
      const cachedMtimes = { "/skills/a.md": 100 };
      const currentFiles = ["/skills/a.md", "/skills/b.md"];

      expect(await isCacheStale(cachedMtimes, currentFiles)).toBe(true);
    });
  });

  describe("given all files present in cache and unchanged", () => {
    beforeEach(() => {
      vi.mocked(fsPromises.stat).mockResolvedValue({
        mtimeMs: 100,
      } as unknown as Stats);
    });

    it("then it should return false because nothing changed", async () => {
      const cachedMtimes = { "/skills/a.md": 100 };
      const currentFiles = ["/skills/a.md"];

      expect(await isCacheStale(cachedMtimes, currentFiles)).toBe(false);
    });
  });

  describe("given a file modified after cache time", () => {
    beforeEach(() => {
      vi.mocked(fsPromises.stat).mockResolvedValue({
        mtimeMs: 200,
      } as unknown as Stats);
    });

    it("then it should return true because the file was updated", async () => {
      const cachedMtimes = { "/skills/a.md": 100 };
      const currentFiles = ["/skills/a.md"];

      expect(await isCacheStale(cachedMtimes, currentFiles)).toBe(true);
    });
  });

  describe("given a file that no longer exists", () => {
    beforeEach(() => {
      vi.mocked(fsPromises.stat).mockRejectedValue(new Error("ENOENT"));
    });

    it("then it should return true because the cached file is missing", async () => {
      const cachedMtimes = { "/skills/deleted.md": 100 };
      const currentFiles: string[] = [];

      expect(await isCacheStale(cachedMtimes, currentFiles)).toBe(true);
    });
  });

  describe("given empty cache and no current files", () => {
    it("then it should return false because there is nothing to check", async () => {
      expect(await isCacheStale({}, [])).toBe(false);
    });
  });
});
