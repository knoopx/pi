import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import { getCached, setCached } from "./cache";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

const mockReadFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = fs.writeFileSync as ReturnType<typeof vi.fn>;
const mockMkdirSync = fs.mkdirSync as ReturnType<typeof vi.fn>;

describe("cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCached", () => {
    it("returns cached content when entry exists and not expired", async () => {
      const entry = JSON.stringify({
        timestamp: Date.now() - 1000,
        content: "cached content",
      });
      mockReadFileSync.mockReturnValue(entry);

      const result = await getCached("https://example.com");
      expect(result).toBe("cached content");
    });

    it("returns null when cache entry is expired", async () => {
      const entry = JSON.stringify({
        timestamp: Date.now() - 100000,
        content: "old content",
      });
      mockReadFileSync.mockReturnValue(entry);

      const result = await getCached("https://example.com", 5000);
      expect(result).toBeNull();
    });

    it("returns null when cache file does not exist", async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const result = await getCached("https://example.com");
      expect(result).toBeNull();
    });

    it("returns null when cache entry is invalid JSON", async () => {
      mockReadFileSync.mockReturnValue("not json");

      const result = await getCached("https://example.com");
      expect(result).toBeNull();
    });
  });

  describe("setCached", () => {
    it("writes cache entry to file", async () => {
      await setCached("https://example.com", "new content");

      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining(".cache/pi-webfetch/"),
        expect.stringContaining("new content"),
        "utf8",
      );
    });

    it("includes timestamp in cache entry", async () => {
      await setCached("https://example.com", "content");

      const written = mockWriteFileSync.mock.calls[0][1] as string;
      const entry = JSON.parse(written);
      expect(entry.timestamp).toBeDefined();
      expect(entry.content).toBe("content");
    });
  });
});
