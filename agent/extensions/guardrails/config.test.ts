import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import defaultsConfig from "./defaults";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

describe("guardrails configLoader", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("given configuration is not loaded yet", () => {
    it("then throws explicit load-first error", async () => {
      const { configLoader } = await import("./config");
      expect(() => configLoader.getConfig()).toThrow(
        "Config not loaded. Call load() first.",
      );
    });
  });

  describe("when loading", () => {
    it("then resolves defaults as active config", async () => {
      const { configLoader } = await import("./config");

      configLoader.load();
      expect(configLoader.getConfig()).toEqual(defaultsConfig);
    });
  });
});
