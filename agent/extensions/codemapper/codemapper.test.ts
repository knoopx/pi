import { describe, it, expect, beforeEach, vi } from "vitest";
import setupCodemapperExtension from "./index";

describe("Scenario: Codemapper Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      exec: vi.fn(),
    };
    setupCodemapperExtension(mockPi);
  });

  it("should register all 8 tools", () => {
    expect(mockPi.registerTool).toHaveBeenCalledTimes(8);

    const toolNames = [
      "code-stats",
      "code-map",
      "code-query",
      "code-inspect",
      "code-callers",
      "code-callees",
      "code-trace",
      "code-deps",
    ];

    toolNames.forEach((name) => {
      expect(mockPi.registerTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name,
        }),
      );
    });
  });

  describe("Given code-stats tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-stats",
      )[0];
    });

    it("should have correct tool metadata", () => {
      expect(registeredTool).toMatchObject({
        name: "code-stats",
        label: "Code Statistics",
        description: expect.stringContaining("statistics"),
      });
    });

    it("should have proper parameter schema", () => {
      expect(registeredTool.parameters).toBeDefined();
      expect(registeredTool.parameters.properties).toHaveProperty("path");
    });

    it("should get code statistics successfully with path", async () => {
      const mockResult = {
        code: 0,
        stdout: "Files: 150\nLines: 25000\nLanguages: 3",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { path: "/test/project" },
        vi.fn(),
        { cwd: "/default/cwd" },
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["stats", "/test/project"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe(
        "Files: 150\nLines: 25000\nLanguages: 3",
      );
      expect(result.isError).not.toBe(true);
    });

    it("should get code statistics with empty params", async () => {
      const mockResult = {
        code: 0,
        stdout: "Default path statistics",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(mockPi.exec).toHaveBeenCalledWith("cm", ["stats", "."], {
        signal: undefined,
      });
      expect(result.content[0].text).toBe("Default path statistics");
    });

    it("should use current directory when no cwd provided", async () => {
      const mockResult = {
        code: 0,
        stdout: "Current directory stats",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(mockPi.exec).toHaveBeenCalledWith("cm", ["stats", "."], {
        signal: undefined,
      });
    });

    it("should handle command execution errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "Permission denied",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(result.content[0].text).toBe("Error: Permission denied");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Tool not found"));

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(result.content[0].text).toContain("Error getting code statistics");
      expect(result.content[0].text).toContain("Tool not found");
    });

    it("should respect abort signal", async () => {
      const mockResult = {
        code: 0,
        stdout: "Results",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const abortController = new AbortController();
      const signal = abortController.signal;

      await registeredTool.execute("tool1", {}, vi.fn(), {}, signal);

      expect(mockPi.exec).toHaveBeenCalledWith("cm", ["stats", "."], {
        signal,
      });
    });
  });

  describe("Given code-map tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-map",
      )[0];
    });

    it("should have correct tool metadata", () => {
      expect(registeredTool).toMatchObject({
        name: "code-map",
        label: "Code Map",
        description: expect.stringContaining("hierarchical"),
      });
    });

    it("should have proper parameter schema", () => {
      const props = registeredTool.parameters.properties;
      expect(props).toHaveProperty("budget");
      expect(props).toHaveProperty("exportedOnly");
      expect(props).toHaveProperty("path");
    });

    it("should generate code map with default parameters", async () => {
      const mockResult = {
        code: 0,
        stdout: "Code map output",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["map", ".", "--level", "2", "--format", "ai"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe("Code map output");
    });

    it("should adjust level based on token budget", async () => {
      const mockResult = {
        code: 0,
        stdout: "Minimal map",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute("tool1", { budget: 1000 }, vi.fn(), {});

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["map", ".", "--level", "1", "--format", "ai"],
        { signal: undefined },
      );
    });

    it("should handle medium budget", async () => {
      const mockResult = { code: 0, stdout: "Medium detail map", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute("tool1", { budget: 3000 }, vi.fn(), {});

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["map", ".", "--level", "2", "--format", "ai"],
        { signal: undefined },
      );
    });

    it("should handle high budget", async () => {
      const mockResult = { code: 0, stdout: "Full detail map", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute("tool1", { budget: 6000 }, vi.fn(), {});

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["map", ".", "--level", "3", "--format", "ai"],
        { signal: undefined },
      );
    });

    it("should include exports-only flag when requested", async () => {
      const mockResult = { code: 0, stdout: "Exports only map", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { exportedOnly: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["map", ".", "--level", "2", "--format", "ai", "--exports-only"],
        { signal: undefined },
      );
    });

    it("should handle command execution errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "Invalid path",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(result.content[0].text).toContain("Error");
      expect(result.content[0].text).toContain("Invalid path");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Process failed"));

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(result.content[0].text).toContain("Error generating code map");
    });
  });

  describe("Given code-query tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-query",
      )[0];
    });

    it("should have correct tool metadata", () => {
      expect(registeredTool).toMatchObject({
        name: "code-query",
        label: "Code Query",
        description: expect.stringContaining("Search"),
      });
    });

    it("should have proper parameter schema", () => {
      const props = registeredTool.parameters.properties;
      expect(props).toHaveProperty("query");
      expect(props).toHaveProperty("exact");
      expect(props).toHaveProperty("showBody");
      expect(props).toHaveProperty("exportsOnly");
      expect(props).toHaveProperty("path");
    });

    it("should query code successfully with basic search", async () => {
      const mockResult = {
        code: 0,
        stdout: "authenticate function found at line 42",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { query: "authenticate" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["query", "authenticate", "."],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe(
        "authenticate function found at line 42",
      );
    });

    it("should support exact matching", async () => {
      const mockResult = { code: 0, stdout: "Exact matches", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { query: "processData", exact: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["query", "processData", ".", "--exact"],
        { signal: undefined },
      );
    });

    it("should support showing function body", async () => {
      const mockResult = {
        code: 0,
        stdout: "Function with implementation",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { query: "validate", showBody: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["query", "validate", ".", "--show-body"],
        { signal: undefined },
      );
    });

    it("should filter for exported symbols only", async () => {
      const mockResult = { code: 0, stdout: "Exported only", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { query: "helper", exportsOnly: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["query", "helper", ".", "--exports-only"],
        { signal: undefined },
      );
    });

    it("should combine multiple flags", async () => {
      const mockResult = { code: 0, stdout: "Combined results", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { query: "MyClass", exact: true, showBody: true, exportsOnly: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["query", "MyClass", ".", "--exact", "--show-body", "--exports-only"],
        { signal: undefined },
      );
    });

    it("should handle no results", async () => {
      const mockResult = {
        code: 0,
        stdout: "No matches found",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { query: "nonexistent" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toBe("No matches found");
    });

    it("should handle command execution errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "Search failed",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { query: "test" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Search crashed"));

      const result = await registeredTool.execute(
        "tool1",
        { query: "test" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error querying code");
    });
  });

  describe("Given code-inspect tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-inspect",
      )[0];
    });

    it("should have correct tool metadata", () => {
      expect(registeredTool).toMatchObject({
        name: "code-inspect",
        label: "Code Inspect",
        description: expect.stringContaining("structure"),
      });
    });

    it("should have file parameter in schema", () => {
      expect(registeredTool.parameters.properties).toHaveProperty("file");
    });

    it("should inspect file successfully", async () => {
      const mockResult = {
        code: 0,
        stdout: "Functions: authenticate, logout\nClasses: User, Session",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { file: "./src/auth.ts" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["inspect", "./src/auth.ts"],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("Functions");
    });

    it("should handle relative file paths", async () => {
      const mockResult = { code: 0, stdout: "File structure", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { file: "../utils/helpers.js" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["inspect", "../utils/helpers.js"],
        { signal: undefined },
      );
    });

    it("should handle absolute file paths", async () => {
      const mockResult = { code: 0, stdout: "File structure", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { file: "/home/user/project/src/main.py" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["inspect", "/home/user/project/src/main.py"],
        { signal: undefined },
      );
    });

    it("should handle file not found errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "File not found",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { file: "./nonexistent.ts" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Inspect failed"));

      const result = await registeredTool.execute(
        "tool1",
        { file: "./test.ts" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error inspecting file");
    });
  });

  describe("Given code-callers tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-callers",
      )[0];
    });

    it("should have correct tool metadata", () => {
      expect(registeredTool).toMatchObject({
        name: "code-callers",
        label: "Code Callers",
        description: expect.stringContaining("locations"),
      });
    });

    it("should have symbol parameter in schema", () => {
      expect(registeredTool.parameters.properties).toHaveProperty("symbol");
      expect(registeredTool.parameters.properties).toHaveProperty("path");
    });

    it("should find callers successfully", async () => {
      const mockResult = {
        code: 0,
        stdout: "Called by: processPayment, refundPayment",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "chargeCard" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["callers", "chargeCard", "."],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("processPayment");
    });

    it("should handle symbols with no callers", async () => {
      const mockResult = {
        code: 0,
        stdout: "No callers found",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "unused_function" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toBe("No callers found");
    });

    it("should handle class methods", async () => {
      const mockResult = {
        code: 0,
        stdout: "Called from multiple places",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { symbol: "User.authenticate" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["callers", "User.authenticate", "."],
        { signal: undefined },
      );
    });

    it("should handle command execution errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "Symbol not found",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "badSymbol" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Callers lookup failed"));

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "test" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error finding callers");
    });
  });

  describe("Given code-callees tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-callees",
      )[0];
    });

    it("should have correct tool metadata", () => {
      expect(registeredTool).toMatchObject({
        name: "code-callees",
        label: "Code Callees",
        description: expect.stringContaining("functions"),
      });
    });

    it("should have symbol parameter in schema", () => {
      expect(registeredTool.parameters.properties).toHaveProperty("symbol");
      expect(registeredTool.parameters.properties).toHaveProperty("path");
    });

    it("should find callees successfully", async () => {
      const mockResult = {
        code: 0,
        stdout: "Calls: validateInput, saveDatabase, logEvent",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "processPayment" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["callees", "processPayment", "."],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("validateInput");
    });

    it("should handle symbols with no callees", async () => {
      const mockResult = {
        code: 0,
        stdout: "No callees found",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "leaf_function" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toBe("No callees found");
    });

    it("should handle class methods", async () => {
      const mockResult = { code: 0, stdout: "Method dependencies", stderr: "" };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { symbol: "Request.handle" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["callees", "Request.handle", "."],
        { signal: undefined },
      );
    });

    it("should handle command execution errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "Cannot analyze",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "test" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Callees analysis failed"));

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "test" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error finding callees");
    });
  });

  describe("Given code-trace tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-trace",
      )[0];
    });

    it("should have correct tool metadata", () => {
      expect(registeredTool).toMatchObject({
        name: "code-trace",
        label: "Code Trace",
        description: expect.stringContaining("path"),
      });
    });

    it("should have from and to parameters in schema", () => {
      const props = registeredTool.parameters.properties;
      expect(props).toHaveProperty("from");
      expect(props).toHaveProperty("to");
      expect(props).toHaveProperty("path");
    });

    it("should trace call path successfully", async () => {
      const mockResult = {
        code: 0,
        stdout: "main -> processRequest -> validateInput -> parseData",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { from: "main", to: "parseData" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["trace", "main", "parseData", "."],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("parseData");
    });

    it("should handle direct calls", async () => {
      const mockResult = {
        code: 0,
        stdout: "authenticate -> validatePassword",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { from: "authenticate", to: "validatePassword" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["trace", "authenticate", "validatePassword", "."],
        { signal: undefined },
      );
    });

    it("should handle no path found", async () => {
      const mockResult = {
        code: 0,
        stdout: "No call path found",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { from: "isolated1", to: "isolated2" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toBe("No call path found");
    });

    it("should handle identical from and to", async () => {
      const mockResult = {
        code: 0,
        stdout: "Source and target are the same",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { from: "recursive", to: "recursive" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["trace", "recursive", "recursive", "."],
        { signal: undefined },
      );
    });

    it("should handle command execution errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "Invalid symbols",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { from: "bad", to: "symbols" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Trace failed"));

      const result = await registeredTool.execute(
        "tool1",
        { from: "a", to: "b" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("Error tracing call path");
    });
  });

  describe("Given code-deps tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-deps",
      )[0];
    });

    it("should have correct tool metadata", () => {
      expect(registeredTool).toMatchObject({
        name: "code-deps",
        label: "Code Dependencies",
        description: expect.stringContaining("dependency"),
      });
    });

    it("should have all parameters in schema", () => {
      const props = registeredTool.parameters.properties;
      expect(props).toHaveProperty("file");
      expect(props).toHaveProperty("reverse");
      expect(props).toHaveProperty("depth");
      expect(props).toHaveProperty("external");
      expect(props).toHaveProperty("circular");
      expect(props).toHaveProperty("path");
    });

    it("should analyze file dependencies successfully", async () => {
      const mockResult = {
        code: 0,
        stdout: "Dependencies: express, lodash, axios",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { file: "src/main.ts", depth: 2 },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["deps", "src/main.ts", "--depth", "2"],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("Dependencies");
    });

    it("should analyze reverse dependencies", async () => {
      const mockResult = {
        code: 0,
        stdout: "Reverse dependencies",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { file: "src/utils.ts", reverse: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["deps", "src/utils.ts", "--direction", "used-by"],
        { signal: undefined },
      );
      expect(result.content[0].text).toContain("Reverse");
    });

    it("should handle external packages flag", async () => {
      const mockResult = {
        code: 0,
        stdout: "express@4.18.0\nlodash@4.17.21",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { external: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["deps", ".", "--external"],
        {
          signal: undefined,
        },
      );
      expect(result.content[0].text).toContain("express");
    });

    it("should detect circular dependencies", async () => {
      const mockResult = {
        code: 0,
        stdout: "Circular: a -> b -> c -> a",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { circular: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["deps", ".", "--circular"],
        {
          signal: undefined,
        },
      );
      expect(result.content[0].text).toContain("Circular");
    });

    it("should handle no dependencies found", async () => {
      const mockResult = {
        code: 0,
        stdout: "No dependencies",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { file: "src/isolated.ts" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toContain("No dependencies");
    });

    it("should combine multiple flags", async () => {
      const mockResult = {
        code: 0,
        stdout: "Complex analysis",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        { file: "src/app.ts", reverse: true, depth: 3, external: true },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        [
          "deps",
          "src/app.ts",
          "--direction",
          "used-by",
          "--depth",
          "3",
          "--external",
        ],
        { signal: undefined },
      );
    });

    it("should work without file parameter", async () => {
      const mockResult = {
        code: 0,
        stdout: "Project-wide circular check",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute("tool1", { circular: true }, vi.fn(), {});

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["deps", ".", "--circular"],
        {
          signal: undefined,
        },
      );
    });

    it("should handle command execution errors", async () => {
      const mockResult = {
        code: 1,
        stdout: "",
        stderr: "Analysis failed",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { file: "bad.ts" },
        vi.fn(),
        {},
      );

      expect(result.content[0].text).toBe("Error: Analysis failed");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Deps analysis crashed"));

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(result.content[0].text).toContain("Error analyzing dependencies");
    });
  });

  describe("Given Error handling across all tools", () => {
    it("should return error response on failure", async () => {
      const tools = [
        "code-stats",
        "code-map",
        "code-query",
        "code-inspect",
        "code-callers",
        "code-callees",
        "code-trace",
        "code-deps",
      ];

      for (const toolName of tools) {
        const tool = mockPi.registerTool.mock.calls.find(
          (call) => call[0].name === toolName,
        )[0];

        mockPi.exec.mockResolvedValueOnce({
          code: 1,
          stdout: "",
          stderr: "Tool error",
        });

        const result = await tool.execute("id", {}, vi.fn(), {});

        expect(result.content[0].type).toBe("text");
        expect(result.content[0].text).toContain("Error");
      }
    });

    it("should have execute function on all tools", () => {
      const toolCount = mockPi.registerTool.mock.calls.length;
      expect(toolCount).toBe(8);

      mockPi.registerTool.mock.calls.forEach((call) => {
        const tool = call[0];
        expect(tool).toHaveProperty("execute");
        expect(typeof tool.execute).toBe("function");
      });
    });

    it("should have description on all tools", () => {
      mockPi.registerTool.mock.calls.forEach((call) => {
        const tool = call[0];
        expect(tool).toHaveProperty("description");
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });

    it("should have parameters schema on all tools", () => {
      mockPi.registerTool.mock.calls.forEach((call) => {
        const tool = call[0];
        expect(tool).toHaveProperty("parameters");
        expect(tool.parameters).toBeDefined();
      });
    });
  });
});
