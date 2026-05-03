import { describe, expect, it } from "vitest";
import { isCacheStale } from "../../shared/cache/cache-helpers";
import { mapToRawChunks } from "./indexer";

describe("isCacheStale", () => {
  describe("given new files not in the cache", () => {
    it("then it should return true because there are uncached files", () => {
      const cachedMtimes = { "/skills/a.md": 100 };
      const currentFiles = ["/skills/a.md", "/skills/b.md"];

      expect(isCacheStale(cachedMtimes, currentFiles)).toBe(true);
    });
  });

  describe("given all files present in cache", () => {
    it("then it should return false because nothing new", () => {
      const cachedMtimes = { "/skills/a.md": 100 };
      const currentFiles = ["/skills/a.md"];

      expect(isCacheStale(cachedMtimes, currentFiles)).toBe(false);
    });
  });

  describe("given empty cache and no current files", () => {
    it("then it should return false because there is nothing to check", () => {
      expect(isCacheStale({}, [])).toBe(false);
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
