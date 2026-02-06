import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { readFile } from "node:fs/promises";

// Mock fs before importing configLoader
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Import after mocking
const { configLoader } = await import("./config");

describe("ConfigLoader", () => {
  const mockReadFile = readFile as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("given valid global config exists", () => {
    describe("when loading configuration", () => {
      it("then uses global config", async () => {
        const mockGroups = [
          {
            group: "test",
            pattern: "^test",
            rules: [
              {
                context: "command",
                pattern: "^test",
                action: "block",
                reason: "test block",
              },
            ],
          },
        ];

        // Mock defaults file to return valid defaults
        mockReadFile.mockImplementation((path: unknown) => {
          if (String(path).includes("settings.json")) {
            return Promise.resolve(JSON.stringify({ guardrails: mockGroups }));
          }
          // defaults.json
          return Promise.resolve(JSON.stringify([]));
        });

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
                context: "command",
                pattern: "^defaults",
                action: "block",
                reason: "defaults block",
              },
            ],
          },
        ];

        mockReadFile.mockImplementation((path: unknown) => {
          if (String(path).includes("settings.json")) {
            return Promise.reject(new Error("File not found"));
          }
          // defaults.json
          return Promise.resolve(JSON.stringify(mockGroups));
        });

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
        mockReadFile.mockRejectedValue(new Error("File not found"));

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
                context: "command",
                pattern: "^test",
                action: "block",
                reason: "test block",
              },
            ],
          },
        ];

        mockReadFile.mockImplementation((path: unknown) => {
          if (String(path).includes("settings.json")) {
            return Promise.resolve(JSON.stringify({ guardrails: mockConfig }));
          }
          return Promise.reject(new Error("File not found"));
        });

        await configLoader.load();
        const config = configLoader.getConfig();

        expect(config).toHaveLength(1);
        expect(config[0].group).toBe("valid");
      });
    });
  });
});
