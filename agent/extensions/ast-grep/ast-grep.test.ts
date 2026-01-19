import { describe, it, expect, beforeEach, vi } from "vitest";
import setupAstGrepExtension from "./index";

describe("AST Grep Extension", () => {
  let mockPi: any;
  let mockCtx: any;

  beforeEach(() => {
    mockPi = {
      on: vi.fn(),
      registerTool: vi.fn(),
      exec: vi.fn(),
    };
    mockCtx = {
      ui: {
        notify: vi.fn(),
      },
    };
    setupAstGrepExtension(mockPi);
  });

  it("should register ast-search tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ast-search",
        label: "AST Search",
      }),
    );
  });

  it("should register ast-replace tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ast-replace",
        label: "AST Replace",
      }),
    );
  });

  it("should register ast-scan tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "ast-scan",
        label: "AST Scan",
      }),
    );
  });

  it("should check for ast-grep availability on session start", () => {
    expect(mockPi.on).toHaveBeenCalledWith(
      "session_start",
      expect.any(Function),
    );
  });

  describe("ast-search tool", () => {
    it("should execute ast-grep search successfully", async () => {
      const mockResult = {
        code: 0,
        stdout: 'test.js:1:console.log("hello");',
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "ast-search",
      )[0];

      const result = await registeredTool.execute(
        "tool1",
        {
          pattern: "console.log",
          language: "javascript",
          path: ".",
        },
        vi.fn(),
        mockCtx,
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "ast-grep",
        ["run", "--pattern", "console.log", "--lang", "javascript", "."],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("Found 1 matches");
      expect(result.details.matchCount).toBe(1);
    });

    it("should handle ast-grep errors", async () => {
      const mockResult = {
        code: 1,
        stderr: "ast-grep: command not found",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "ast-search",
      )[0];

      const result = await registeredTool.execute(
        "tool1",
        {
          pattern: "console.log($$$ARGS)",
          language: "javascript",
        },
        vi.fn(),
        mockCtx,
      );

      expect(result.content[0].text).toContain("ast-grep error");
    });
  });

  describe("ast-replace tool", () => {
    it("should preview changes in dry run mode", async () => {
      const mockResult = {
        code: 0,
        stdout:
          'test.js\n@@ -0,1 +0,1 @@\n1  │-console.log("old");\n  1│+console.log("new");',
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "ast-replace",
      )[0];

      const result = await registeredTool.execute(
        "tool1",
        {
          pattern: "console.log($MSG)",
          rewrite: "console.log($MSG)",
          language: "javascript",
          dryRun: true,
        },
        vi.fn(),
        mockCtx,
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "ast-grep",
        [
          "run",
          "--pattern",
          "console.log($MSG)",
          "--rewrite",
          "console.log($MSG)",
          "--lang",
          "javascript",
          ".",
        ],
        expect.any(Object),
      );
      expect(result.content[0].text).toContain("Preview of changes");
      expect(result.details.preview).toBe(true);
    });

    it("should apply changes when dry run is false", async () => {
      const mockResult = {
        code: 0,
        stdout: "Applied 2 changes",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "ast-replace",
      )[0];

      const result = await registeredTool.execute(
        "tool1",
        {
          pattern: "console.log($MSG)",
          rewrite: "console.log($MSG)",
          language: "javascript",
          dryRun: false,
        },
        vi.fn(),
        mockCtx,
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "ast-grep",
        [
          "run",
          "--pattern",
          "console.log($MSG)",
          "--rewrite",
          "console.log($MSG)",
          "--lang",
          "javascript",
          "--update-all",
          ".",
        ],
        expect.any(Object),
      );
      expect(result.details.applied).toBe(true);
    });
  });

  describe("ast-scan tool", () => {
    it("should execute advanced scan successfully", async () => {
      const mockResult = {
        code: 0,
        stdout:
          "help[scan-rule]: \n  ┌─ test.js:1:1\n  │\n1 │ function test() {}\n  │ ^^^^^^^^^^^^^^^^^^\n",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "ast-scan",
      )[0];

      const rule =
        '{"kind": "function_declaration", "has": {"pattern": "await $EXPR"}}';
      const result = await registeredTool.execute(
        "tool1",
        {
          rule,
          language: "javascript",
        },
        vi.fn(),
        mockCtx,
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "ast-grep",
        [
          "scan",
          "--inline-rules",
          `{"id": "scan-rule", "language": "javascript", "rule": ${rule}}`,
          ".",
        ],
        expect.any(Object),
      );
      expect(result.content[0].text).toContain("Scan results");
    });

    it("should validate JSON rule", async () => {
      const registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "ast-scan",
      )[0];

      const result = await registeredTool.execute(
        "tool1",
        {
          rule: "invalid json",
          language: "javascript",
        },
        vi.fn(),
        mockCtx,
      );

      expect(result.content[0].text).toContain("Invalid JSON rule");
    });
  });
});
