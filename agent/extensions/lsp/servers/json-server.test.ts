/**
 * JSON Server - BDD Unit Tests
 *
 * Tests JSON language server configuration and functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

import { jsonServerConfig, getJsonServerConfig } from "./json-server";

describe("jsonServerConfig", () => {
  describe("given the JSON server configuration", () => {
    describe("when accessing server ID", () => {
      it("then returns 'json'", () => {
        const config = getJsonServerConfig();

        expect(config.id).toBe("json");
      });
    });

    describe("when checking supported extensions", () => {
      it("then supports JSON extensions", () => {
        const config = getJsonServerConfig();

        expect(config.extensions).toContain(".json");
      });
    });
  });
});

describe("JSON server - Supported files", () => {
  describe("given a JSON file", () => {
    describe("when checking server configuration", () => {
      it("then returns correct configuration for .json files", () => {
        const config = getJsonServerConfig();

        // Check if extension is supported
        expect(config.extensions).toContain(".json");
      });
    });
  });
});

describe("JSON server - Project root", () => {
  describe("given a JSON file", () => {
    describe("when finding project root", () => {
      it("then returns current working directory", () => {
        const file = "/project/config.json";
        const cwd = "/project";

        const result = jsonServerConfig.findRoot(file, cwd);

        expect(result).toBe(cwd);
      });
    });

    describe("when finding project root with different cwd", () => {
      it("then returns the specified cwd", () => {
        const file = "/project/config.json";
        const cwd = "/different/project";

        const result = jsonServerConfig.findRoot(file, cwd);

        expect(result).toBe(cwd);
      });
    });
  });
});

describe("JSON server - Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = "/tmp/lsp-test-json-integration";
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given a JSON project", () => {
    describe("when checking server config", () => {
      it("then returns correct configuration", () => {
        const config = getJsonServerConfig();

        expect(config.id).toBe("json");
        expect(config.extensions).toContain(".json");
        expect(config.findRoot).toBeDefined();
      });
    });

    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = path.join(testDir, "config.json");
        const cwd = testDir;

        const result = jsonServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });
});

describe("JSON server - Edge Cases", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = "/tmp/lsp-test-json-edge";
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given nested JSON files", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = path.join(testDir, "config", "subdir", "config.json");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });

        const result = jsonServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given absolute path", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = "/absolute/path/config.json";
        const cwd = testDir;

        const result = jsonServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given relative path", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = "./config/config.json";
        const cwd = testDir;

        const result = jsonServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });
});
