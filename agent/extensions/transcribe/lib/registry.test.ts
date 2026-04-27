import { describe, expect, it } from "vitest";
import { parse } from "./registry";

describe("registry", () => {
  describe("local file handling", () => {
    it("handles /dev/null (empty file)", async () => {
      const result = await parse("/dev/null");
      expect(result).toBeDefined();
    });

    it("handles empty string as source", async () => {
      // Empty string goes through generic parser which treats it as a local file
      // This will fail with ENOENT, which is expected behavior for missing files
      await expect(
        parse("", undefined as unknown as AbortSignal),
      ).rejects.toThrow("ENOENT");
    });
  });

  describe("AbortSignal support", () => {
    it("respects abort signal", async () => {
      const controller = new AbortController();
      controller.abort();

      // When aborted, the convert function should fail early
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
        // The generic parser matches everything and treats non-URL strings as local files
        await expect(
          parse(url, undefined as unknown as AbortSignal),
        ).rejects.toThrow("ENOENT");
      },
    );
  });
});
