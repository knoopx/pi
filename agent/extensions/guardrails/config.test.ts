import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { readFile, writeFile } from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

const { configLoader, loadGuardrailsSettings, saveGuardrailsSettings } =
  await import("./config");

// Shared test fixtures
const defaultConfig = [
  {
    group: "defaults",
    pattern: "*",
    rules: [
      {
        context: "command",
        pattern: "bun *",
        action: "block",
        reason: "defaults",
      },
    ],
  },
];

// Shared helper to create mock readFile implementations
function createMockReadFileImpl(
  globalConfig: unknown | null,
  defaultConfigValue: unknown = defaultConfig,
) {
  return (path: unknown) => {
    if (String(path).includes("settings.json")) {
      if (globalConfig !== null)
        return Promise.resolve(JSON.stringify({ guardrails: globalConfig }));
      return Promise.reject(new Error("missing"));
    }
    return Promise.resolve(JSON.stringify(defaultConfigValue));
  };
}

describe("guardrails configLoader", () => {
  const mockReadFile = readFile as unknown as Mock;
  const mockWriteFile = writeFile as unknown as Mock;

  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.resetAllMocks());

  describe("given global config exists", () => {
    it("then global overrides defaults", async () => {
      const global = [
        {
          group: "global",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "npm *",
              action: "block",
              reason: "global",
            },
          ],
        },
      ];

      mockReadFile.mockImplementation(
        createMockReadFileImpl(global, defaultConfig),
      );

      await configLoader.load();
      expect(configLoader.getConfig()).toHaveLength(1);
      expect(configLoader.getConfig()[0].group).toBe("global");
    });
  });

  describe("given no global config", () => {
    it("then uses defaults", async () => {
      mockReadFile.mockImplementation(
        createMockReadFileImpl(null, defaultConfig),
      );

      await configLoader.load();
      expect(configLoader.getConfig()).toHaveLength(1);
      expect(configLoader.getConfig()[0].group).toBe("defaults");
    });
  });

  describe("given both files missing", () => {
    it("then returns empty config", async () => {
      mockReadFile.mockRejectedValue(new Error("missing"));
      await configLoader.load();
      expect(configLoader.getConfig()).toEqual([]);
    });
  });

  describe("given malformed JSON", () => {
    it("then handles parse failures gracefully", async () => {
      mockReadFile.mockResolvedValue("{broken");
      await configLoader.load();
      expect(configLoader.getConfig()).toEqual([]);
    });
  });

  describe("given guardrails settings object", () => {
    it("then loads enabled state from nested guardrails settings", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          guardrails: {
            enabled: false,
            rules: [],
          },
        }),
      );

      await expect(loadGuardrailsSettings()).resolves.toEqual({
        enabled: false,
      });
    });

    it("then preserves existing guardrails fields when saving settings", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({
          guardrails: {
            enabled: true,
            rules: [{ group: "x", pattern: "*", rules: [] }],
            extra: "keep",
          },
          theme: "custom",
        }),
      );

      await saveGuardrailsSettings({ enabled: false });

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string) as {
        guardrails: Record<string, unknown>;
      };

      expect(written.guardrails.enabled).toBe(false);
      expect(written.guardrails.extra).toBe("keep");
      expect(written.guardrails.rules).toEqual([
        { group: "x", pattern: "*", rules: [] },
      ]);
    });

    it("then refuses to write when settings cannot be parsed", async () => {
      mockReadFile.mockResolvedValue("{broken");

      await expect(saveGuardrailsSettings({ enabled: false })).rejects.toThrow(
        "Unable to read settings.json safely",
      );
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe("given invalid groups and rules", () => {
    it("then filters out invalid entries", async () => {
      const cfg = [
        "bad",
        {
          group: "missing-rules",
          pattern: "*",
        },
        {
          group: "bad-rule",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "npm *",
              action: "warn",
              reason: "bad",
            },
          ],
        },
        {
          group: "good",
          pattern: "*",
          rules: [
            {
              context: "command",
              pattern: "npm *",
              action: "block",
              reason: "ok",
            },
          ],
        },
      ];

      mockReadFile.mockImplementation((path: unknown) => {
        if (String(path).includes("settings.json"))
          return Promise.resolve(JSON.stringify({ guardrails: cfg }));
        return Promise.resolve(JSON.stringify([]));
      });

      await configLoader.load();
      const loaded = configLoader.getConfig();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].group).toBe("good");
    });
  });

  describe("given scope option", () => {
    it("then accepts valid scope values", async () => {
      const cfg = [
        {
          group: "project-scope",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "test",
              scope: "project",
              action: "block",
              reason: "project only",
            },
          ],
        },
        {
          group: "external-scope",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "config",
              scope: "external",
              action: "block",
              reason: "external only",
            },
          ],
        },
      ];

      mockReadFile.mockImplementation((path: unknown) => {
        if (String(path).includes("settings.json"))
          return Promise.resolve(JSON.stringify({ guardrails: cfg }));
        return Promise.resolve(JSON.stringify([]));
      });

      await configLoader.load();
      const loaded = configLoader.getConfig();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].group).toBe("project-scope");
      expect(loaded[1].group).toBe("external-scope");
    });

    it("then filters out rules with invalid scope values", async () => {
      const cfg = [
        {
          group: "bad-scope",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "test",
              scope: "invalid" as unknown as "project" | "external",
              action: "block",
              reason: "bad scope",
            },
          ],
        },
        {
          group: "good",
          pattern: "*",
          rules: [
            {
              context: "file_name",
              pattern: "test",
              action: "block",
              reason: "no scope",
            },
          ],
        },
      ];

      mockReadFile.mockImplementation((path: unknown) => {
        if (String(path).includes("settings.json"))
          return Promise.resolve(JSON.stringify({ guardrails: cfg }));
        return Promise.resolve(JSON.stringify([]));
      });

      await configLoader.load();
      const loaded = configLoader.getConfig();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].group).toBe("good");
    });
  });
});
