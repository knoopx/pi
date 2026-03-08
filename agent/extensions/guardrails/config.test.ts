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
      const defaults = [
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

      mockReadFile.mockImplementation((path: unknown) => {
        if (String(path).includes("settings.json")) {
          return Promise.resolve(JSON.stringify({ guardrails: global }));
        }
        return Promise.resolve(JSON.stringify(defaults));
      });

      await configLoader.load();
      expect(configLoader.getConfig()).toHaveLength(1);
      expect(configLoader.getConfig()[0].group).toBe("global");
    });
  });

  describe("given no global config", () => {
    it("then uses defaults", async () => {
      const defaults = [
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

      mockReadFile.mockImplementation((path: unknown) => {
        if (String(path).includes("settings.json")) {
          return Promise.reject(new Error("missing"));
        }
        return Promise.resolve(JSON.stringify(defaults));
      });

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
        if (String(path).includes("settings.json")) {
          return Promise.resolve(JSON.stringify({ guardrails: cfg }));
        }
        return Promise.resolve(JSON.stringify([]));
      });

      await configLoader.load();
      const loaded = configLoader.getConfig();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].group).toBe("good");
    });
  });
});
