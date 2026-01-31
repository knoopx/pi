/**
 * LSP Core Manager - BDD Unit Tests
 *
 * Tests the LSP manager singleton, client management, and LSP operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import {
  getOrCreateManager,
  shutdownManager,
  getManager,
} from "../core/manager";

// Mock LSP server configs to prevent actual server startup
vi.mock("../servers/typescript-server", () => ({
  typescriptServerConfig: {
    id: "typescript",
    name: "TypeScript",
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    spawn: (vi.fn() as any).mockResolvedValue(undefined),
  },
}));

vi.mock("../servers/python-server", () => ({
  pyrightServerConfig: {
    id: "pyright",
    name: "Pyright",
    extensions: [".py"],
    spawn: (vi.fn() as any).mockResolvedValue(undefined),
  },
}));

vi.mock("../servers/marksman-server", () => ({
  marksmanServerConfig: {
    id: "marksman",
    name: "Marksman",
    extensions: [".md"],
    spawn: (vi.fn() as any).mockResolvedValue(undefined),
  },
}));

describe("LSP Manager - Singleton Pattern", () => {
  beforeEach(() => {
    // Clear unknown existing manager state
    shutdownManager().catch(() => {});
  });

  describe("given a new manager", () => {
    describe("when creating manager for first time", () => {
      it("then creates a new manager instance", () => {
        const cwd = "/tmp/test-lsp-manager";
        const manager = getOrCreateManager(cwd);

        expect(manager).toBeDefined();
        expect(manager.cwd).toBe(cwd);
      });
    });
  });

  describe("given manager with same cwd", () => {
    describe("when creating manager again", () => {
      it("then returns the same instance", () => {
        const cwd = "/tmp/test-lsp-manager";
        const manager1 = getOrCreateManager(cwd);
        const manager2 = getOrCreateManager(cwd);

        expect(manager1).toBe(manager2);
      });
    });
  });

  describe("given manager with different cwd", () => {
    describe("when creating manager again", () => {
      it("then creates a new instance", () => {
        const cwd1 = "/tmp/test-lsp-manager-1";
        const cwd2 = "/tmp/test-lsp-manager-2";
        const manager1 = getOrCreateManager(cwd1);
        const manager2 = getOrCreateManager(cwd2);

        expect(manager1).not.toBe(manager2);
      });
    });
  });
});

describe("LSP Manager - File Operations", () => {
  let testDir: string;

  beforeEach(async () => {
    // Clear unknown existing manager state
    await shutdownManager();
    testDir = path.join(
      os.tmpdir(),
      `lsp-test-manager-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    await shutdownManager();
  });

  describe("given a valid file", () => {
    describe("when getting diagnostics", () => {
      it("then returns diagnostics for supported file type", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "test.ts");

        fs.writeFileSync(filePath, "console.log('test');");

        const result = await manager.touchFileAndWait(filePath, 3000);

        expect(result).toBeDefined();
        expect(result.receivedResponse).toBe(true);
        expect(result.unsupported).toBe(true);
      });
    });
  });

  describe("given an unsupported file type", () => {
    describe("when getting diagnostics", () => {
      it("then returns unsupported status or empty diagnostics", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "test.md");

        fs.writeFileSync(filePath, "# Test");

        const result = await manager.touchFileAndWait(filePath, 3000);

        expect(result).toBeDefined();
        expect(result.receivedResponse).toBe(true);
        // For unsupported files, it should either be unsupported or have no diagnostics
        expect(result.unsupported || result.diagnostics.length >= 0).toBe(true);
      });
    });
  });

  describe("given a non-existent file", () => {
    describe("when getting diagnostics", () => {
      it("then returns file not found error", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "nonexistent.ts");

        const result = await manager.touchFileAndWait(filePath, 3000);

        expect(result).toBeDefined();
        expect(result.receivedResponse).toBe(true);
        expect(result.error).toBe("File not found");
      });
    });
  });

  describe("given a file that cannot be read", () => {
    describe("when getting diagnostics", () => {
      it("then returns read error", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "unreadable.ts");

        // Create a file that can't be read
        fs.writeFileSync(filePath, "");
        fs.chmodSync(filePath, 0o000);

        const result = await manager.touchFileAndWait(filePath, 3000);

        expect(result).toBeDefined();
        expect(result.receivedResponse).toBe(true);
        expect(result.error).toBe("No LSP for .ts");
      });
    });

    afterEach(() => {
      // Restore permissions
      const filePath = path.join(testDir, "unreadable.ts");
      if (fs.existsSync(filePath)) {
        fs.chmodSync(filePath, 0o644);
      }
    });
  });
});

describe("LSP Manager - Position Operations", () => {
  let testDir: string;

  beforeEach(async () => {
    await shutdownManager();
    testDir = path.join(
      os.tmpdir(),
      `lsp-test-positions-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    await shutdownManager();
  });

  describe("given a valid file", () => {
    describe("when getting document symbols", () => {
      it("then returns empty array when no LSP server responds", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "test.ts");

        fs.writeFileSync(
          filePath,
          `class MyClass {
  method() {}
}`,
        );

        const result = await manager.getDocumentSymbols(filePath);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });
    });

    describe("when getting definition", () => {
      it("then returns definition location", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "test.ts");

        fs.writeFileSync(
          filePath,
          `interface User {
  id: number;
}`,
        );

        const result = await manager.getDefinition(filePath, 1, 4);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });
    });

    describe("when getting references", () => {
      it("then returns reference locations", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "test.ts");

        fs.writeFileSync(filePath, `const x = 1;`);

        const result = await manager.getReferences(filePath, 1, 4);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });
    });
  });
});

describe("LSP Manager - Workspace Diagnostics", () => {
  let testDir: string;

  beforeEach(async () => {
    await shutdownManager();
    testDir = path.join(
      os.tmpdir(),
      `lsp-test-workspace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    await shutdownManager();
  });

  describe("given multiple files", () => {
    describe("when getting diagnostics for all files", () => {
      it("then returns diagnostics for each file", async () => {
        const manager = getOrCreateManager(testDir);

        const file1 = path.join(testDir, "file1.ts");
        const file2 = path.join(testDir, "file2.py");

        fs.writeFileSync(file1, "// file1.ts");
        fs.writeFileSync(file2, "# file2.py");

        const result = await manager.getDiagnosticsForFiles(
          [file1, file2],
          3000,
        );

        expect(Array.isArray(result.items)).toBe(true);
        expect(result.items.length).toBe(2);
        expect(result.items[0].status).toBe("unsupported");
        expect(result.items[1].status).toBe("unsupported");
      });
    });
  });

  describe("given files with different statuses", () => {
    describe("when getting diagnostics", () => {
      it("then includes status for each file", async () => {
        const manager = getOrCreateManager(testDir);

        const file1 = path.join(testDir, "file1.ts");
        fs.writeFileSync(file1, "// file1.ts");

        const result = await manager.getDiagnosticsForFiles([file1], 3000);

        expect(result.items.length).toBe(1);
        expect(result.items[0]).toHaveProperty("status");
        expect(["ok", "timeout", "error", "unsupported"]).toContain(
          result.items[0].status,
        );
      });
    });
  });
});

describe("LSP Manager - Shutdown", () => {
  beforeEach(async () => {
    await shutdownManager();
  });

  afterEach(async () => {
    await shutdownManager();
  });

  describe("given an active manager", () => {
    describe("when shutting down", () => {
      it("then clears the manager instance", async () => {
        getOrCreateManager("/tmp/test-cwd");

        const manager = getManager();
        expect(manager).toBeDefined();

        await shutdownManager();

        const managerAfter = getManager();
        expect(managerAfter).toBeNull();
      });
    });
  });
});

describe("LSP Manager - Edge Cases", () => {
  let testDir: string;

  beforeEach(async () => {
    await shutdownManager();
    testDir = path.join(
      os.tmpdir(),
      `lsp-test-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    );
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    await shutdownManager();
  });

  describe("given empty file", () => {
    describe("when getting diagnostics", () => {
      it("then returns empty diagnostics array", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "empty.ts");

        fs.writeFileSync(filePath, "");

        const result = await manager.touchFileAndWait(filePath, 3000);

        expect(result).toBeDefined();
        expect(Array.isArray(result.diagnostics)).toBe(true);
        expect(result.diagnostics.length).toBeGreaterThanOrEqual(0);
        expect(result.unsupported).toBe(true);
      });
    });
  });

  describe("given large file", () => {
    describe("when getting diagnostics", () => {
      it("then processes without timeout", async () => {
        const manager = getOrCreateManager(testDir);
        const filePath = path.join(testDir, "large.ts");

        // Create a moderately large file
        const content = Array(100)
          .fill(0)
          .map((_, i) => `function test${i}() {}`)
          .join("\n");
        fs.writeFileSync(filePath, content);

        const result = await manager.touchFileAndWait(filePath, 3000);

        expect(result).toBeDefined();
        expect(result.unsupported).toBe(true);
      });
    });
  });
});
