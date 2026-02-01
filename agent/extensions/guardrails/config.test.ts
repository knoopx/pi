import { describe, it, expect, vi } from "vitest";
import { configLoader } from "./config";

describe("ConfigLoader", () => {
  describe("given valid global config exists", () => {
    describe("when loading configuration", () => {
      it("then uses global config", async () => {
        const mockGroups = [
          {
            group: "test",
            pattern: "^test",
            rules: [
              {
                pattern: "^test",
                action: "block",
                reason: "test block",
              },
            ],
          },
        ];

        vi.spyOn(configLoader as any, "loadGlobalFile").mockResolvedValue(
          mockGroups,
        );
        vi.spyOn(configLoader as any, "loadDefaultsFile").mockResolvedValue(null);

        await configLoader.load();

        const config = configLoader.getConfig();
        expect(Array.isArray(config)).toBe(true);
        expect(config).toHaveLength(1);
        expect(config[0].group).toBe("test");
      });
    });
  });

  describe("given no global config exists", () => {
    describe("when loading configuration", () => {
      it("then uses defaults config", async () => {
        const mockGroups = [
          {
            group: "defaults",
            pattern: "^defaults",
            rules: [
              {
                pattern: "^defaults",
                action: "block",
                reason: "defaults block",
              },
            ],
          },
        ];

        vi.spyOn(configLoader as any, "loadGlobalFile").mockResolvedValue(null);
        vi.spyOn(configLoader as any, "loadDefaultsFile").mockResolvedValue(
          mockGroups,
        );

        await configLoader.load();

        const config = configLoader.getConfig();
        expect(Array.isArray(config)).toBe(true);
        expect(config).toHaveLength(1);
        expect(config[0].group).toBe("defaults");
      });
    });
  });

  describe("given missing config files", () => {
    describe("when loading configuration", () => {
      it("then returns empty array", async () => {
        vi.spyOn(configLoader as any, "loadGlobalFile").mockResolvedValue(null);
        vi.spyOn(configLoader as any, "loadDefaultsFile").mockResolvedValue(null);

        await configLoader.load();

        const config = configLoader.getConfig();
        expect(Array.isArray(config)).toBe(true);
        expect(config).toHaveLength(0);
      });
    });
  });

  describe("given invalid config entries", () => {
    describe("when merging configs", () => {
      it("then filters out invalid groups", async () => {
        const mockConfig = [
          "invalid string",
          { invalid: "object" },
          {
            group: "valid",
            pattern: "^test",
            rules: [
              {
                pattern: "^test",
                action: "block",
                reason: "test block",
              },
            ],
          },
        ];

        vi.spyOn(configLoader as any, "loadGlobalFile").mockResolvedValue(
          mockConfig,
        );
        vi.spyOn(configLoader as any, "loadDefaultsFile").mockResolvedValue(null);

        await configLoader.load();
        const config = configLoader.getConfig();

        expect(config).toHaveLength(1);
        expect(config[0].group).toBe("valid");
      });
    });
  });
});
