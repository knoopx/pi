import { describe, expect, it } from "vitest";
import { parse } from "./registry";

describe("registry", () => {
  describe("local file handling", () => {
    it("handles /dev/null (empty file)", async () => {
      const result = await parse("/dev/null");
      expect(result).toBeDefined();
    });

    it("handles empty string as source", async () => {
      await expect(
        parse("", undefined as unknown as AbortSignal),
      ).rejects.toThrow("ENOENT");
    });
  });

  describe("AbortSignal support", () => {
    it("respects abort signal", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        parse(
          "https://github.com/user/repo",
          controller.signal as unknown as AbortSignal,
        ),
      ).rejects.toThrow(/Aborted|abort/);
    });
  });

  describe("unparseable URLs use generic parser fallback", () => {
    it.each(["not-a-url", "ftp://example.com/file", "mailto:test@example.com"])(
      "treats unsupported protocol as local file: %s",
      async (url) => {
        await expect(
          parse(url, undefined as unknown as AbortSignal),
        ).rejects.toThrow("ENOENT");
      },
    );
  });
});
