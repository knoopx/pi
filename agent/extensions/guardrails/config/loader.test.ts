import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import defaultsConfig from "../defaults/all";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

function mockFsPromises(content: string): void {
  vi.resetModules();
  vi.doMock("node:fs/promises", () => ({
    readFile: vi.fn().mockResolvedValue(content),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  }));
}

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

  describe("loadGuardrailsSettings", () => {
    it("loads settings with enabled=true", async () => {
      mockFsPromises('{"guardrails":{"enabled":true}}');
      const { loadGuardrailsSettings } = await import("./loader");
      const settings = await loadGuardrailsSettings();
      expect(settings.enabled).toBe(true);
    });
  });

  describe("saveGuardrailsSettings", () => {
    it("saves settings updates", async () => {
      mockFsPromises('{"guardrails":{"enabled":true}}');
      const { saveGuardrailsSettings } = await import("./loader");
      const result = await saveGuardrailsSettings({ enabled: false });
      expect(result.enabled).toBe(false);
    });
  });
});
