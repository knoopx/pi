import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { retry } from "./retry";

describe("retry", () => {
  describe("success on first attempt", () => {
    it("returns the result of a successful call", async () => {
      const fn = vi.fn(() => Promise.resolve(42));
      const result = await retry(fn);
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("passes the return type through generics", async () => {
      const fn = () => Promise.resolve({ ok: true, data: "hello" });
      const result = await retry<{ ok: boolean; data: string }>(fn);
      expect(result).toEqual({ ok: true, data: "hello" });
    });
  });

  describe("retry on transient errors", () => {
    it("retries on network error and returns on success", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Timeout"))
        .mockResolvedValue(42);

      const result = await retry(fn, { maxRetries: 3, retryDelay: 1 });
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("retries on 5xx HTTP errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("HTTP 503: Service Unavailable"))
        .mockResolvedValue("ok");

      const result = await retry(fn, { maxRetries: 2, retryDelay: 1 });
      expect(result).toBe("ok");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 4xx errors", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("HTTP 404: Not Found"));

      await expect(retry(fn, { maxRetries: 3 })).rejects.toThrow(
        "HTTP 404: Not Found",
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("does not retry on abort errors", async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error("Aborted"));

      await expect(retry(fn, { maxRetries: 3 })).rejects.toThrow("Aborted");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("throws after exhausting retries", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Transient"));

      await expect(retry(fn, { maxRetries: 2, retryDelay: 1 })).rejects.toThrow(
        "Transient",
      );
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe("error wrapping", () => {
    it("wraps non-Error values in Error", async () => {
      const fn = vi.fn().mockRejectedValue("string error");

      await expect(retry(fn, { maxRetries: 0 })).rejects.toThrow(
        "string error",
      );
    });
  });
});
