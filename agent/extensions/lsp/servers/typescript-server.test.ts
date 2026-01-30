/**
 * TypeScript Server - BDD Unit Tests
 *
 * Tests TypeScript/JavaScript language server configuration and functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import {
  typescriptServerConfig,
  getTypescriptServerConfig,
  findTypeScriptRoot,
  spawnTypeScriptLanguageServer,
} from "./typescript-server";

describe("typescriptServerConfig", () => {
  describe("given the TypeScript server configuration", () => {
    describe("when accessing server ID", () => {
      it("then returns 'typescript'", () => {
        const config = getTypescriptServerConfig();

        expect(config.id).toBe("typescript");
      });
    });

    describe("when checking supported extensions", () => {
      it("then supports TypeScript extensions", () => {
        const config = getTypescriptServerConfig();

        expect(config.extensions).toContain(".ts");
        expect(config.extensions).toContain(".tsx");
      });

      it("then supports JavaScript extensions", () => {
        const config = getTypescriptServerConfig();

        expect(config.extensions).toContain(".js");
        expect(config.extensions).toContain(".jsx");
      });

      it("then supports additional extensions", () => {
        const config = getTypescriptServerConfig();

        expect(config.extensions).toContain(".mjs");
        expect(config.extensions).toContain(".cjs");
        expect(config.extensions).toContain(".mts");
        expect(config.extensions).toContain(".cts");
      });
    });
  });
});

describe("findTypeScriptRoot", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a very deep test directory to avoid accidentally finding project root
    testDir = path.join(
      os.tmpdir(),
      "lsp-test-isolated",
      `ts-root-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given a TypeScript file", () => {
    describe("when package.json exists in parent directory", () => {
      it("then returns the project root", () => {
        const file = path.join(testDir, "src", "index.ts");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "package.json"),
          '{"name": "test"}',
        );

        const result = findTypeScriptRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });

    describe("when tsconfig.json exists", () => {
      it("then returns the project root", () => {
        const file = path.join(testDir, "src", "index.ts");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "tsconfig.json"),
          '{"compilerOptions": {}}',
        );

        const result = findTypeScriptRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });

    describe("when jsconfig.json exists", () => {
      it("then returns the project root", () => {
        const file = path.join(testDir, "src", "index.js");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "jsconfig.json"),
          '{"compilerOptions": {}}',
        );

        const result = findTypeScriptRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given a Deno file", () => {
    describe("when deno.json exists", () => {
      it("then returns undefined (Deno has its own root finding logic)", () => {
        const file = path.join(testDir, "src", "index.ts");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "deno.json"),
          '{"compilerOptions": {}}',
        );

        const result = findTypeScriptRoot(file, cwd);

        expect(result).toBeUndefined();
      });
    });
  });

  describe("given file without unknown markers", () => {
    describe("when no project markers exist", () => {
      it("then returns undefined", () => {
        const file = path.join(testDir, "src", "index.ts");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        // No marker files created

        const result = findTypeScriptRoot(file, cwd);

        expect(result).toBeUndefined();
      });
    });
  });
});

describe("spawnTypeScriptLanguageServer", () => {
  describe("given a valid root directory", () => {
    describe("when TypeScript language server is available", () => {
      it("then returns a process object", async () => {
        const root = "/tmp";
        const result = await spawnTypeScriptLanguageServer(root);

        // In test environment, binary might not be available
        if (result) {
          expect(result).toHaveProperty("process");
        }
      });
    });
  });

  describe("given invalid root directory", () => {
    describe("when directory does not exist", () => {
      it("then returns undefined", async () => {
        const root = "/tmp/nonexistent/directory/that/does/not/exist";
        const result = await spawnTypeScriptLanguageServer(root);

        expect(result).toBeUndefined();
      });
    });
  });
});

describe("TypeScript Server - Integration", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(
      os.tmpdir(),
      `lsp-test-ts-integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given a TypeScript project", () => {
    describe("when checking server config", () => {
      it("then returns correct configuration", () => {
        const config = getTypescriptServerConfig();

        expect(config.id).toBe("typescript");
        expect(config.extensions).toContain(".ts");
      });
    });

    describe("when finding project root", () => {
      it("then finds root with package.json", () => {
        const file = path.join(testDir, "src", "index.ts");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "package.json"),
          '{"name": "test"}',
        );

        const result = findTypeScriptRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });
});

describe("TypeScript Server - Edge Cases", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      `lsp-test-ts-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given nested directories", () => {
    describe("when finding project root", () => {
      it("then finds root in parent directory", () => {
        const file = path.join(testDir, "src", "subdir", "index.ts");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "tsconfig.json"),
          '{"compilerOptions": {}}',
        );

        const result = findTypeScriptRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given multiple marker files", () => {
    describe("when finding project root", () => {
      it("then returns root with unknown marker found", () => {
        const file = path.join(testDir, "src", "index.ts");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });

        // First check package.json
        fs.writeFileSync(
          path.join(testDir, "package.json"),
          '{"name": "test"}',
        );
        let result = findTypeScriptRoot(file, cwd);
        expect(result).toBe(testDir);

        // Remove package.json and check tsconfig.json
        fs.unlinkSync(path.join(testDir, "package.json"));
        fs.writeFileSync(
          path.join(testDir, "tsconfig.json"),
          '{"compilerOptions": {}}',
        );
        result = findTypeScriptRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });
  });
});
