import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { acquireSlot, throttledFetch, resetThrottleState } from "./throttle";

beforeEach(() => {
  resetThrottleState();
});

describe("acquireSlot", () => {
  it("resolves immediately on first call", async () => {
    const start = Date.now();
    await acquireSlot("example.com", 1000);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("delays second call within interval", async () => {
    const interval = 200;
    await acquireSlot("a.com", interval);
    const start = Date.now();
    await acquireSlot("a.com", interval);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(interval - 20);
  });

  it("does not delay calls to different hosts", async () => {
    const interval = 500;
    await acquireSlot("host-a.com", interval);
    const start = Date.now();
    await acquireSlot("host-b.com", interval);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("queues multiple requests to same host in order", async () => {
    const interval = 100;
    const order: number[] = [];

    await acquireSlot("q.com", interval);

    const p1 = acquireSlot("q.com", interval).then(() => order.push(1));
    const p2 = acquireSlot("q.com", interval).then(() => order.push(2));
    const p3 = acquireSlot("q.com", interval).then(() => order.push(3));

    await Promise.all([p1, p2, p3]);
    expect(order).toEqual([1, 2, 3]);
  });
});

describe("throttledFetch", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response("ok", { status: 200 }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("calls global fetch with correct arguments", async () => {
    await throttledFetch("https://api.example.com/data", {
      method: "POST",
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.example.com/data",
      { method: "POST" },
    );
  });

  it("throttles sequential calls to the same host", async () => {
    const interval = 150;
    await throttledFetch("https://api.test.com/a", undefined, interval);
    const start = Date.now();
    await throttledFetch("https://api.test.com/b", undefined, interval);
    expect(Date.now() - start).toBeGreaterThanOrEqual(interval - 20);
  });
});
