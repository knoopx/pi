import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import defaultsConfig from "../defaults/all";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

function expectDefaultActive(config: {
  load(): void;
  getConfig(): unknown;
}): void {
  config.load();
  expect(config.getConfig()).toEqual(defaultsConfig);
}

describe("guardrails configLoader", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("given configuration is not loaded yet", () => {
    it("then throws explicit load-first error", async () => {
      const { configLoader } = await import("./loader");
      expect(() => configLoader.getConfig()).toThrow(
        "Config not loaded. Call load() first.",
      );
    });
  });

  describe("when loading", () => {
    it("then resolves defaults as active config", async () => {
      const { configLoader } = await import("./loader");
      expectDefaultActive(configLoader);
    });
  });
});
