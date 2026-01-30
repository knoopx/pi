/**
 * Marksman Server - BDD Unit Tests
 *
 * Tests Markdown language server configuration and functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import {
  marksmanServerConfig,
  getMarksmanServerConfig,
} from "./marksman-server";

describe("marksmanServerConfig", () => {
  describe("given the Marksman server configuration", () => {
    describe("when accessing server ID", () => {
      it("then returns 'marksman'", () => {
        const config = getMarksmanServerConfig();

        expect(config.id).toBe("marksman");
      });
    });

    describe("when checking supported extensions", () => {
      it("then supports Markdown extensions", () => {
        const config = getMarksmanServerConfig();

        expect(config.extensions).toContain(".md");
      });
    });
  });
});

describe("Marksman server - Supported files", () => {
  describe("given a Markdown file", () => {
    describe("when checking server configuration", () => {
      it("then returns correct configuration for .md files", () => {
        const config = getMarksmanServerConfig();
        const ext = path.extname("README.md");

        // Check if extension is supported
        expect(config.extensions).toContain(".md");
      });
    });
  });
});

describe("Marksman server - Project root", () => {
  describe("given a Markdown file", () => {
    describe("when finding project root", () => {
      it("then returns current working directory", () => {
        const file = "/project/README.md";
        const cwd = "/project";

        const result = marksmanServerConfig.findRoot(file, cwd);

        expect(result).toBe(cwd);
      });
    });

    describe("when finding project root with different cwd", () => {
      it("then returns the specified cwd", () => {
        const file = "/project/README.md";
        const cwd = "/different/project";

        const result = marksmanServerConfig.findRoot(file, cwd);

        expect(result).toBe(cwd);
      });
    });
  });
});

describe("Marksman server - Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = "/tmp/lsp-test-marksman-integration";
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given a Markdown project", () => {
    describe("when checking server config", () => {
      it("then returns correct configuration", () => {
        const config = getMarksmanServerConfig();

        expect(config.id).toBe("marksman");
        expect(config.extensions).toContain(".md");
        expect(config.findRoot).toBeDefined();
      });
    });

    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = path.join(testDir, "README.md");
        const cwd = testDir;

        const result = marksmanServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });
});

describe("Marksman server - Edge Cases", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = "/tmp/lsp-test-marksman-edge";
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given nested Markdown files", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = path.join(testDir, "docs", "subdir", "README.md");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });

        const result = marksmanServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given absolute path", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = "/absolute/path/README.md";
        const cwd = testDir;

        const result = marksmanServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given relative path", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = "./docs/README.md";
        const cwd = testDir;

        const result = marksmanServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });
});

describe("Marksman server - Empty scenarios", () => {
  describe("given no project markers", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = "/project/README.md";
        const cwd = "/project";

        const result = marksmanServerConfig.findRoot(file, cwd);

        // Marksman always returns cwd, regardless of markers
        expect(result).toBe(cwd);
      });
    });
  });
});
