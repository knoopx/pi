import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { loadAndDisplay } from "./loader";

describe("loadAndDisplay", () => {
  let ctx: ExtensionCommandContext;
  let collectData: (signal: AbortSignal) => Promise<{ count: number } | null>;
  let createComponent: (
    theme: unknown,
    data: { count: number },
  ) => { render: () => string[]; handleInput: (input: string) => void };

  beforeEach(() => {
    collectData = vi.fn().mockResolvedValue({ count: 5 } as unknown);
    createComponent = vi.fn().mockReturnValue({
      render: vi.fn().mockReturnValue(["test"]),
      handleInput: vi.fn(),
    });
  });

  it("returns early when no UI", async () => {
    ctx = {
      hasUI: false,
      cwd: "/test",
    } as ExtensionCommandContext;

    await loadAndDisplay(ctx, "loading...", collectData, createComponent);
    expect(collectData).not.toHaveBeenCalled();
  });
});
