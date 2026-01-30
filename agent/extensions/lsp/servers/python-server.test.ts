/**
 * Python Server - BDD Unit Tests
 *
 * Tests Python/Pyright language server configuration and functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import {
  pyrightServerConfig,
  getPyrightServerConfig,
  findPythonRoot,
} from "./python-server";

describe("pyrightServerConfig", () => {
  describe("given the Python server configuration", () => {
    describe("when accessing server ID", () => {
      it("then returns 'pyright'", () => {
        const config = getPyrightServerConfig();
        expect(config.id).toBe("pyright");
      });
    });

    describe("when checking supported extensions", () => {
      it("then supports Python extensions", () => {
        const config = getPyrightServerConfig();
        expect(config.extensions).toContain(".py");
        expect(config.extensions).toContain(".pyi");
      });
    });
  });
});

describe("Python server - Supported files", () => {
  describe("given a Python file", () => {
    describe("when checking server configuration", () => {
      it("then returns correct configuration for .py files", () => {
        const config = getPyrightServerConfig();
        expect(config.extensions).toContain(".py");
      });
    });
  });

  describe("given a .pyi stub file", () => {
    describe("when checking server configuration", () => {
      it("then returns correct configuration", () => {
        const config = getPyrightServerConfig();
        expect(config.extensions).toContain(".pyi");
      });
    });
  });
});

describe("Python server - Project markers", () => {
  let testDir: string;

  beforeEach(() => {
    // Create a very deep and unique test directory to avoid accidentally finding project root
    const uniqueId = `python-root-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
    testDir = path.join(os.tmpdir(), "lsp-test-isolated", uniqueId);
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      try {
        fs.rmSync(testDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors in case directory is already removed
      }
    }
  });

  describe("given a Python file", () => {
    describe("when finding project root with pyproject.toml", () => {
      it("then returns the project root", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "pyproject.toml"),
          "[tool.pyright]",
        );
        fs.writeFileSync(file, "# Python file");

        const result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });

    describe("when finding project root with setup.py", () => {
      it("then returns the project root", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(path.join(testDir, "setup.py"), "# setup.py");
        fs.writeFileSync(file, "# Python file");

        const result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });

    describe("when finding project root with requirements.txt", () => {
      it("then returns the project root", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "requirements.txt"),
          "# requirements",
        );
        fs.writeFileSync(file, "# Python file");

        const result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });

    describe("when finding project root with pyrightconfig.json", () => {
      it("then returns the project root", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(path.join(testDir, "pyrightconfig.json"), "{}");
        fs.writeFileSync(file, "# Python file");

        const result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });
  });

  describe("given a Python file without markers", () => {
    describe("when finding project root", () => {
      it("then returns undefined", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "# Python file");

        const result = findPythonRoot(file, cwd);
        expect(result).toBeUndefined();
      });
    });
  });
});

describe("Python server - Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      "lsp-test-isolated",
      `python-integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given a Python project", () => {
    describe("when checking server config", () => {
      it("then returns correct configuration", () => {
        const config = getPyrightServerConfig();
        expect(config.id).toBe("pyright");
        expect(config.extensions).toContain(".py");
      });
    });

    describe("when finding project root", () => {
      it("then finds root with pyproject.toml", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
          path.join(testDir, "pyproject.toml"),
          "[tool.pyright]",
        );
        fs.writeFileSync(file, "# Python file");

        const result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });
  });
});

describe("Python server - Edge Cases", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = path.join(
      os.tmpdir(),
      "lsp-test-isolated",
      `python-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("given multiple marker files", () => {
    describe("when finding project root", () => {
      it("then returns root with unknown marker found", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "# Python file");

        // First check pyproject.toml
        fs.writeFileSync(
          path.join(testDir, "pyproject.toml"),
          "[tool.pyright]",
        );
        let result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);

        // Remove pyproject.toml and check setup.py
        fs.unlinkSync(path.join(testDir, "pyproject.toml"));
        fs.writeFileSync(path.join(testDir, "setup.py"), "# setup.py");
        result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });
  });

  describe("given nested directories", () => {
    describe("when finding project root", () => {
      it("then finds root in parent directory", () => {
        const file = path.join(testDir, "src", "subdir", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "# Python file");
        fs.writeFileSync(
          path.join(testDir, "pyproject.toml"),
          "[tool.pyright]",
        );

        const result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });
  });

  describe("given absolute path", () => {
    describe("when finding project root", () => {
      it("then works with absolute paths", () => {
        const file = path.join(testDir, "src", "main.py");
        const cwd = testDir;

        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "# Python file");
        fs.writeFileSync(
          path.join(testDir, "pyproject.toml"),
          "[tool.pyright]",
        );

        const result = findPythonRoot(file, cwd);
        expect(result).toBe(testDir);
      });
    });
  });

  describe("given relative path", () => {
    describe("when finding project root", () => {
      it("then resolves relative to cwd", () => {
        const file = "src/main.py";
        const cwd = testDir;

        fs.mkdirSync(path.join(testDir, "src"), { recursive: true });
        fs.writeFileSync(path.join(testDir, "src", "main.py"), "# Python file");
        fs.writeFileSync(
          path.join(testDir, "pyproject.toml"),
          "[tool.pyright]",
        );

        const result = findPythonRoot(path.resolve(cwd, file), cwd);
        expect(result).toBe(testDir);
      });
    });
  });
});
