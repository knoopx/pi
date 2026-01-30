/**
 * Server Configs - BDD Unit Tests
 *
 * Tests the LSP server configurations array
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { LSP_SERVERS } from "./server-configs";
import { typescriptServerConfig } from "../servers/typescript-server";
import { pyrightServerConfig } from "../servers/python-server";
import { marksmanServerConfig } from "../servers/marksman-server";
import { yamlServerConfig } from "../servers/yaml-server";
import { jsonServerConfig } from "../servers/json-server";

describe("LSP_SERVERS array", () => {
  describe("given the LSP servers array", () => {
    describe("when checking the servers", () => {
      it("then contains TypeScript server", () => {
        expect(LSP_SERVERS).toBeDefined();
        expect(LSP_SERVERS.length).toBeGreaterThan(0);
        expect(LSP_SERVERS[0].id).toBe("typescript");
      });

      it("then contains Python server", () => {
        expect(LSP_SERVERS).toBeDefined();
        expect(LSP_SERVERS.length).toBeGreaterThanOrEqual(2);
        expect(LSP_SERVERS[1].id).toBe("pyright");
      });

      it("then contains Marksman server", () => {
        expect(LSP_SERVERS).toBeDefined();
        expect(LSP_SERVERS.length).toBeGreaterThanOrEqual(3);
        expect(LSP_SERVERS[2].id).toBe("marksman");
      });

      it("then contains YAML server", () => {
        expect(LSP_SERVERS).toBeDefined();
        expect(LSP_SERVERS.length).toBeGreaterThanOrEqual(4);
        expect(LSP_SERVERS[3].id).toBe("yaml");
      });

      it("then contains JSON server", () => {
        expect(LSP_SERVERS).toBeDefined();
        expect(LSP_SERVERS.length).toBeGreaterThanOrEqual(5);
        expect(LSP_SERVERS[4].id).toBe("json");
      });
    });
  });
});

describe("TypeScript server config", () => {
  describe("given TypeScript server configuration", () => {
    describe("when checking server details", () => {
      it("then has correct server ID", () => {
        expect(typescriptServerConfig.id).toBe("typescript");
      });

      it("then has supported extensions", () => {
        expect(typescriptServerConfig.extensions).toContain(".ts");
        expect(typescriptServerConfig.extensions).toContain(".tsx");
        expect(typescriptServerConfig.extensions).toContain(".js");
        expect(typescriptServerConfig.extensions).toContain(".jsx");
      });

      it("then has findRoot function", () => {
        expect(typeof typescriptServerConfig.findRoot).toBe("function");
      });

      it("then has spawn function", () => {
        expect(typeof typescriptServerConfig.spawn).toBe("function");
      });
    });
  });
});

describe("Python server config", () => {
  describe("given Python server configuration", () => {
    describe("when checking server details", () => {
      it("then has correct server ID", () => {
        expect(pyrightServerConfig.id).toBe("pyright");
      });

      it("then has supported extensions", () => {
        expect(pyrightServerConfig.extensions).toContain(".py");
        expect(pyrightServerConfig.extensions).toContain(".pyi");
      });

      it("then has findRoot function", () => {
        expect(typeof pyrightServerConfig.findRoot).toBe("function");
      });

      it("then has spawn function", () => {
        expect(typeof pyrightServerConfig.spawn).toBe("function");
      });
    });
  });
});

describe("Marksman server config", () => {
  describe("given Marksman server configuration", () => {
    describe("when checking server details", () => {
      it("then has correct server ID", () => {
        expect(marksmanServerConfig.id).toBe("marksman");
      });

      it("then has supported extensions", () => {
        expect(marksmanServerConfig.extensions).toContain(".md");
      });

      it("then has findRoot function", () => {
        expect(typeof marksmanServerConfig.findRoot).toBe("function");
      });

      it("then has spawn function", () => {
        expect(typeof marksmanServerConfig.spawn).toBe("function");
      });
    });
  });
});

describe("YAML server config", () => {
  describe("given YAML server configuration", () => {
    describe("when checking server details", () => {
      it("then has correct server ID", () => {
        expect(yamlServerConfig.id).toBe("yaml");
      });

      it("then has supported extensions", () => {
        expect(yamlServerConfig.extensions).toContain(".yaml");
        expect(yamlServerConfig.extensions).toContain(".yml");
      });

      it("then has findRoot function", () => {
        expect(typeof yamlServerConfig.findRoot).toBe("function");
      });

      it("then has spawn function", () => {
        expect(typeof yamlServerConfig.spawn).toBe("function");
      });
    });
  });
});

describe("JSON server config", () => {
  describe("given JSON server configuration", () => {
    describe("when checking server details", () => {
      it("then has correct server ID", () => {
        expect(jsonServerConfig.id).toBe("json");
      });

      it("then has supported extensions", () => {
        expect(jsonServerConfig.extensions).toContain(".json");
      });

      it("then has findRoot function", () => {
        expect(typeof jsonServerConfig.findRoot).toBe("function");
      });

      it("then has spawn function", () => {
        expect(typeof jsonServerConfig.spawn).toBe("function");
      });
    });
  });
});

describe("Server configuration - Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      "lsp-test-isolated",
      `server-configs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("given all servers", () => {
    describe("when checking configurations", () => {
      it("then all servers have required properties", () => {
        for (const server of LSP_SERVERS) {
          expect(server).toHaveProperty("id");
          expect(server).toHaveProperty("extensions");
          expect(server).toHaveProperty("findRoot");
          expect(server).toHaveProperty("spawn");
          expect(typeof server.id).toBe("string");
          expect(Array.isArray(server.extensions)).toBe(true);
          expect(typeof server.findRoot).toBe("function");
          expect(typeof server.spawn).toBe("function");
        }
      });
    });
  });

  describe("given TypeScript server", () => {
    describe("when finding project root", () => {
      it("then finds root with package.json", () => {
        const file = path.join(testDir, "src", "index.ts");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "package.json"),
          '{"name": "test"}',
        );

        const result = typescriptServerConfig.findRoot(file, cwd);
        expect(result).toBeDefined();
        expect(typeof result).toBe("string");
        expect(fs.existsSync(path.join(result!, "package.json"))).toBe(true);
      });
    });
  });

  describe("given Python server", () => {
    describe("when finding project root", () => {
      it("then finds root with pyproject.toml", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "pyproject.toml"),
          "[tool.pyright]",
        );

        const result = pyrightServerConfig.findRoot(file, cwd);
        expect(result).toBeDefined();
        expect(typeof result).toBe("string");
        expect(fs.existsSync(path.join(result!, "pyproject.toml"))).toBe(true);
      });
    });
  });

  describe("given Marksman server", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = path.join(testDir, "README.md");
        const cwd = testDir;

        const result = marksmanServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given YAML server", () => {
    describe("when finding project root", () => {
      it("then returns current directory", () => {
        const file = path.join(testDir, "config.yaml");
        const cwd = testDir;

        const result = yamlServerConfig.findRoot(file, cwd);

        expect(result).toBe(testDir);
      });
    });
  });

  describe("given JSON server", () => {
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

describe("Server configuration - Edge Cases", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      "lsp-test-isolated",
      `server-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("given TypeScript server with multiple markers", () => {
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
        let result = typescriptServerConfig.findRoot(file, cwd);
        expect(result).toBeDefined();
        expect(fs.existsSync(path.join(result!, "package.json"))).toBe(true);

        // Remove package.json and check tsconfig.json
        fs.unlinkSync(path.join(testDir, "package.json"));
        fs.writeFileSync(
          path.join(testDir, "tsconfig.json"),
          '{"compilerOptions": {}}',
        );
        result = typescriptServerConfig.findRoot(file, cwd);
        expect(result).toBeDefined();
        expect(fs.existsSync(path.join(result!, "tsconfig.json"))).toBe(true);
      });
    });
  });

  describe("given Python server with multiple markers", () => {
    describe("when finding project root", () => {
      it("then returns root with unknown marker found", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });

        // First check pyproject.toml
        fs.writeFileSync(
          path.join(testDir, "pyproject.toml"),
          "[tool.pyright]",
        );
        let result = pyrightServerConfig.findRoot(file, cwd);
        expect(result).toBeDefined();
        expect(fs.existsSync(path.join(result!, "pyproject.toml"))).toBe(true);

        // Remove pyproject.toml and check setup.py
        fs.unlinkSync(path.join(testDir, "pyproject.toml"));
        fs.writeFileSync(path.join(testDir, "setup.py"), "# setup.py");
        result = pyrightServerConfig.findRoot(file, cwd);
        expect(result).toBeDefined();
        expect(fs.existsSync(path.join(result!, "setup.py"))).toBe(true);
      });
    });
  });
});
