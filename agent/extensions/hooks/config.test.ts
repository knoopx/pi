import { describe, expect, it } from "vitest";
import defaultsConfig from "./defaults";

describe("configLoader", () => {
  describe("given configuration is not loaded yet", () => {
    describe("when reading resolved config", () => {
      it("then throws explicit load-first error", async () => {
        const { configLoader } = await import("./config");
        expect(() => configLoader.getConfig()).toThrow(
          "Config not loaded. Call load() first.",
        );
      });
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
