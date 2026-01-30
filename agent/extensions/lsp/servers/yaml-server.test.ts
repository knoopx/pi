/**
 * YAML Server - BDD Unit Tests
 *
 * Tests YAML language server configuration and functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import { yamlServerConfig, getYamlServerConfig } from "./yaml-server";

describe("yamlServerConfig", () => {
  describe("given the YAML server configuration", () => {
    describe("when accessing server ID", () => {
      it("then returns 'yaml'", () => {
        const config = getYamlServerConfig();

        expect(config.id).toBe("yaml");
      });
    });

    describe("when checking supported extensions", () => {
      it("then supports YAML extensions", () => {
        const config = getYamlServerConfig();

        expect(config.extensions).toContain(".yaml");
        expect(config.extensions).toContain(".yml");
      });
    });
  });
});

describe("YAML server - Supported files", () => {
  describe("given a YAML file", () => {
    describe("when checking server configuration", () => {
      it("then returns correct configuration for .yaml files", () => {
        const config = getYamlServerConfig();

        // Check if extension is supported
        expect(config.extensions).toContain(".yaml");
      });

      it("then returns correct configuration for .yml files", () => {
        const config = getYamlServerConfig();

        // Check if extension is supported
        expect(config.extensions).toContain(".yml");
      });
    });
  });
});

describe("YAML server - Project root", () => {
  describe("given a YAML file", () => {
    describe("when finding project root", () => {
      it("then returns current working directory", () => {
        const file = "/project/config.yaml";
        const cwd = "/project";

        const result = yamlServerConfig.findRoot(file, cwd);

        expect(result).toBe(cwd);
      });
    });

    describe("when finding project root with different cwd", () => {
      it("then returns the specified cwd", () => {
        const file = "/project/config.yaml";
        const cwd = "/different/project";

        const result = yamlServerConfig.findRoot(file, cwd);

        expect(result).toBe(cwd);
      });
    });
  });
});

describe("YAML server - Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = "/tmp/lsp-test-yaml-integration";
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given a YAML project", () => {
    describe("when checking server config", () => {
      it("then returns correct configuration", () => {
        const config = getYamlServerConfig();

        expect(config.id).toBe("yaml");
        expect(config.extensions).toContain(".yaml");
        expect(config.extensions).toContain(".yml");
        expect(config.findRoot).toBeDefined();
      });
    });

    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = path.join(testDir, "config.yaml");
        const cwd = testDir;

        const result = yamlServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });
});

describe("YAML server - Edge Cases", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = "/tmp/lsp-test-yaml-edge";
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given nested YAML files", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = path.join(testDir, "config", "subdir", "config.yaml");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });

        const result = yamlServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given absolute path", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = "/absolute/path/config.yaml";
        const cwd = testDir;

        const result = yamlServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given relative path", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = "./config/config.yaml";
        const cwd = testDir;

        const result = yamlServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });
});
