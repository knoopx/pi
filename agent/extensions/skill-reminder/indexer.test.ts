import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Stats } from "node:fs";
import { isCacheStale } from "../../shared/cache/cache-helpers";
import { mapToRawChunks } from "./indexer";

vi.mock("node:os", () => ({
  homedir: () => "/home/testuser",
}));

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

describe("mapToRawChunks", () => {
  it("produces file paths relative to home with ~ prefix", () => {
    const chunks = [{ text: "# Test\n\nSome content here for testing." }];
    const result = mapToRawChunks(
      chunks,
      "test-skill",
      "/home/testuser/.pi/agent/skills/test-skill/file.md",
      1000,
    );

    expect(result).toHaveLength(1);
    expect(result[0].file).toBe("~/.pi/agent/skills/test-skill/file.md");
  });

  it("handles nested skill paths correctly", () => {
    const chunks = [{ text: "# Test\n\nSome content here for testing." }];
    const result = mapToRawChunks(
      chunks,
      "nu-shell",
      "/home/testuser/.pi/agent/skills/nu-shell/references/system.md",
      1000,
    );

    expect(result[0].file).toBe(
      "~/.pi/agent/skills/nu-shell/references/system.md",
    );
  });

  it("includes correct skill name and section", () => {
    const chunks = [{ text: "# Test\n\nSome content here for testing." }];
    const result = mapToRawChunks(
      chunks,
      "my-skill",
      "/home/testuser/.pi/agent/skills/my-skill/doc.md",
      1000,
    );

    expect(result[0].skill).toBe("my-skill");
    expect(result[0].section).toBe("Test");
  });
});
