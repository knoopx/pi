import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HooksConfig } from "./schema";

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/home/test-user"),
}));

const defaultsConfig = [
  {
    group: "typescript",
    pattern: "tsconfig.json",
    hooks: [{ event: "tool_result", command: "bun run typecheck" }],
  },
];

const projectConfig = [
  {
    group: "typescript",
    pattern: "tsconfig.json",
    hooks: [{ event: "agent_end", command: "bunx jscpd ." }],
  },
  {
    group: "nix",
    pattern: "*",
    hooks: [{ event: "tool_result", command: "alejandra -q %file%" }],
  },
];

// Shared test setup helpers
function createMockReadFileWithGlobalHooks(globalHooks: unknown) {
  return vi.fn().mockImplementation(async (path: unknown) => {
    const file = String(path);
    if (file.endsWith("defaults.json")) {
      return JSON.stringify(defaultsConfig);
    }
    if (file.endsWith(".pi/agent/settings.json")) {
      return JSON.stringify({ hooks: globalHooks });
    }
    throw new Error("missing file");
  });
}

async function loadConfigModule() {
  vi.resetModules();
  const fs = await import("node:fs/promises");
  const mod = await import("./config");
  return {
    configLoader: mod.configLoader,
    readFile: vi.mocked(fs.readFile),
    writeFile: vi.mocked(fs.writeFile),
    mkdir: vi.mocked(fs.mkdir),
  };
}

describe("configLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("given configuration is not loaded yet", () => {
    describe("when reading resolved config", () => {
      it("then throws explicit load-first error", async () => {
        const { configLoader } = await loadConfigModule();
        expect(() => configLoader.getConfig()).toThrow(
          "Config not loaded. Call load() first.",
        );
      });
    });
  });

  describe("given valid defaults and no valid global configuration", () => {
    describe("when loading", () => {
      it("then resolves defaults as active config", async () => {
        const { configLoader, readFile } = await loadConfigModule();

        readFile.mockImplementation(async (path) => {
          const file = String(path);
          if (file.endsWith("defaults.json")) {
            return JSON.stringify(defaultsConfig);
          }
          throw new Error("missing file");
        });

        await configLoader.load();

        expect(configLoader.getConfig()).toEqual(defaultsConfig);
        expect(configLoader.hasDefaultsConfig()).toBe(true);
        expect(configLoader.hasGlobalConfig()).toBe(false);
      });
    });
  });

  describe("given valid defaults and valid global hooks", () => {
    describe("when loading", () => {
      it("then global config fully overrides defaults", async () => {
        const { configLoader, readFile } = await loadConfigModule();

        const globalHooks = [
          {
            group: "global-only",
            pattern: "*",
            hooks: [{ event: "agent_end", command: "bunx eslint ." }],
          },
        ];

        readFile.mockImplementation(createMockReadFileWithGlobalHooks(globalHooks));

        await configLoader.load();

        expect(configLoader.getConfig()).toEqual(globalHooks);
        expect(configLoader.getGlobalConfig()).toEqual(globalHooks);
        expect(configLoader.hasGlobalConfig()).toBe(true);
      });
    });
  });

  describe("given invalid global hooks with valid defaults", () => {
    describe("when loading", () => {
      it("then ignores invalid global hooks and keeps defaults", async () => {
        const { configLoader, readFile } = await loadConfigModule();

        readFile.mockImplementation(async (path) => {
          const file = String(path);
          if (file.endsWith("defaults.json")) {
            return JSON.stringify(defaultsConfig);
          }
          if (file.endsWith(".pi/agent/settings.json")) {
            return JSON.stringify({ hooks: { invalid: true } });
          }
          throw new Error("missing file");
        });

        await configLoader.load();

        expect(configLoader.getConfig()).toEqual(defaultsConfig);
        expect(configLoader.hasGlobalConfig()).toBe(false);
      });
    });
  });

  describe("given defaults and project configuration for a cwd", () => {
    describe("when resolving project config", () => {
      it("then merges project hooks by group and appends new groups", async () => {
        const { configLoader, readFile } = await loadConfigModule();

        readFile.mockImplementation(async (path) => {
          const file = String(path);
          if (file.endsWith("defaults.json")) {
            return JSON.stringify(defaultsConfig);
          }
          if (file.endsWith("/workspace/.pi/hooks.json")) {
            return JSON.stringify(projectConfig);
          }
          throw new Error("missing file");
        });

        await configLoader.load();
        const merged = await configLoader.getConfigForProject("/workspace");

        expect(merged).toEqual([
          {
            group: "typescript",
            pattern: "tsconfig.json",
            hooks: [
              { event: "tool_result", command: "bun run typecheck" },
              { event: "agent_end", command: "bunx jscpd ." },
            ],
          },
          {
            group: "nix",
            pattern: "*",
            hooks: [{ event: "tool_result", command: "alejandra -q %file%" }],
          },
        ]);
      });
    });
  });

  describe("given project config has already been loaded once", () => {
    describe("when requesting config for the same cwd again", () => {
      it("then reuses cache and avoids duplicate project file reads", async () => {
        const { configLoader, readFile } = await loadConfigModule();

        readFile.mockImplementation(async (path) => {
          const file = String(path);
          if (file.endsWith("defaults.json")) {
            return JSON.stringify(defaultsConfig);
          }
          if (file.endsWith("/workspace/.pi/hooks.json")) {
            return JSON.stringify(projectConfig);
          }
          throw new Error("missing file");
        });

        await configLoader.load();
        await configLoader.getConfigForProject("/workspace");
        await configLoader.getConfigForProject("/workspace");

        const projectReads = readFile.mock.calls.filter((call) =>
          String(call[0]).endsWith("/workspace/.pi/hooks.json"),
        );

        expect(projectReads).toHaveLength(1);
      });
    });
  });

  describe("given valid global hooks are loaded", () => {
    describe("when resolving project config", () => {
      it("then global hooks still take precedence over project config", async () => {
        const { configLoader, readFile } = await loadConfigModule();

        const globalHooks = [
          {
            group: "global-only",
            pattern: "*",
            hooks: [{ event: "agent_end", command: "bunx eslint ." }],
          },
        ];

        readFile.mockImplementation(async (path) => {
          const file = String(path);
          if (file.endsWith("defaults.json")) {
            return JSON.stringify(defaultsConfig);
          }
          if (file.endsWith(".pi/agent/settings.json")) {
            return JSON.stringify({ hooks: globalHooks });
          }
          if (file.endsWith("/workspace/.pi/hooks.json")) {
            return JSON.stringify(projectConfig);
          }
          throw new Error("missing file");
        });

        await configLoader.load();
        const resolved = await configLoader.getConfigForProject("/workspace");

        expect(resolved).toEqual(globalHooks);
      });
    });
  });

  describe("given existing settings file contains unrelated keys", () => {
    describe("when saving global hooks", () => {
      it("then preserves existing keys and writes hooks atomically", async () => {
        const { configLoader, readFile, writeFile, mkdir } =
          await loadConfigModule();

        readFile.mockImplementation(async (path) => {
          const file = String(path);
          if (file.endsWith("defaults.json")) {
            return JSON.stringify(defaultsConfig);
          }
          if (file.endsWith(".pi/agent/settings.json")) {
            return JSON.stringify({ theme: "custom", defaultModel: "gpt-5" });
          }
          throw new Error("missing file");
        });

        await configLoader.load();
        const previousVersion = configLoader.getVersion();

        const newHooks: HooksConfig = [
          {
            group: "security",
            pattern: "*",
            hooks: [{ event: "tool_call", command: "echo gate" }],
          },
        ];

        await configLoader.saveGlobal(newHooks);

        expect(mkdir).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledTimes(1);

        const [, payload] = writeFile.mock.calls[0];
        const written = JSON.parse(String(payload));

        expect(written.theme).toBe("custom");
        expect(written.defaultModel).toBe("gpt-5");
        expect(written.hooks).toEqual(newHooks);
        expect(configLoader.getVersion()).toBeGreaterThan(previousVersion);
      });
    });
  });
});
