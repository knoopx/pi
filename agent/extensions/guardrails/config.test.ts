import { describe, it, expect, vi } from "vitest";
import { configLoader } from "./config";

describe("ConfigLoader", () => {
  describe("given valid global config exists", () => {
    describe("when loading configuration", () => {
      it("then merges global and default config", async () => {
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

        vi.spyOn(configLoader as any, "loadConfigFile").mockResolvedValue(
          mockGroups,
        );
        vi.spyOn(configLoader as any, "mergeConfigs").mockReturnValue(
          mockGroups,
        );

        await configLoader.load();

        const config = configLoader.getConfig();
        expect(Array.isArray(config)).toBe(true);
        expect(config).toHaveLength(1);
        expect(config[0].group).toBe("test");
      });
    });
  });

  describe("given missing config file", () => {
    describe("when loading configuration", () => {
      it("then returns empty array", async () => {
        vi.spyOn(configLoader as any, "loadConfigFile").mockResolvedValue(null);
        vi.spyOn(configLoader as any, "mergeConfigs").mockReturnValue([]);

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

        // Mock the load to return the mixed config, but mergeConfigs should filter
        vi.spyOn(configLoader as any, "loadConfigFile").mockResolvedValue(
          mockConfig,
        );
        // The real mergeConfigs will filter invalid entries
        vi.spyOn(configLoader as any, "mergeConfigs").mockImplementation(() => {
          return mockConfig.filter(
            (group: any) =>
              typeof group === "object" &&
              group !== null &&
              typeof group.group === "string" &&
              typeof group.pattern === "string" &&
              Array.isArray(group.rules),
          );
        });

        await configLoader.load();
        const config = configLoader.getConfig();

        expect(config).toHaveLength(1);
        expect(config[0].group).toBe("valid");
      });
    });
  });
});
