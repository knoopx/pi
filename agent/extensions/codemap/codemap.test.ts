import { describe, it, expect, beforeEach, vi } from "vitest";
import setupCodemapExtension from "./index";

describe("Codemap Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      exec: vi.fn(),
    };
    setupCodemapExtension(mockPi);
  });

  it("should register codemap tools", () => {
    expect(mockPi.registerTool).toHaveBeenCalledTimes(8); // Now we have 8 tools
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "code-stats",
        label: "Code Statistics",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "code-map",
        label: "Code Map",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "code-query",
        label: "Code Query",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "code-inspect",
        label: "Code Inspect",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "code-callers",
        label: "Code Callers",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "code-callees",
        label: "Code Callees",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "code-trace",
        label: "Code Trace",
      }),
    );
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "code-deps",
        label: "Code Dependencies",
      }),
    );
  });

  describe("code-stats tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-stats",
      )[0];
    });

    it("should get code statistics successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Project statistics output",
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
      expect(result.content[0].text).toBe("Project statistics output");
    });
  });

  describe("code-map tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-map",
      )[0];
    });

    it("should generate code map successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Code map output",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {
        cwd: "/test/project",
      });

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["map", "/test/project", "--level", "2", "--format", "ai"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe("Code map output");
    });
  });

  describe("code-query tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-query",
      )[0];
    });

    it("should query code successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Query results",
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
        ["query", "authenticate"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe("Query results");
    });
  });

  describe("code-inspect tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-inspect",
      )[0];
    });

    it("should inspect file successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "File inspection output",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { file: "./src/auth.py" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["inspect", "./src/auth.py"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe("File inspection output");
    });
  });

  describe("code-callers tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-callers",
      )[0];
    });

    it("should find callers successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Callers list",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "process_payment" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["callers", "process_payment"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe("Callers list");
    });
  });

  describe("code-callees tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-callees",
      )[0];
    });

    it("should find callees successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Callees list",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { symbol: "process_payment" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["callees", "process_payment"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe("Callees list");
    });
  });

  describe("code-trace tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-trace",
      )[0];
    });

    it("should trace call path successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Call trace path",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        { from: "main", to: "process_payment" },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["trace", "main", "process_payment"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe("Call trace path");
    });
  });

  describe("code-deps tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "code-deps",
      )[0];
    });

    it("should analyze dependencies successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Dependency analysis output",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        {
          file: "src/main.ts",
          reverse: true,
          depth: 3,
        },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "cm",
        ["deps", "src/main.ts", "--reverse", "--depth", "3"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe("Dependency analysis output");
    });

    it("should handle external packages flag", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "External packages list",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        {
          external: true,
        },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith("cm", ["deps", "--external"], {
        signal: undefined,
      });
    });

    it("should handle circular dependencies flag", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Circular dependencies found",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      await registeredTool.execute(
        "tool1",
        {
          circular: true,
        },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith("cm", ["deps", "--circular"], {
        signal: undefined,
      });
    });

    it("should handle command execution errors", async () => {
      const mockResult = {
        exitCode: 1,
        stdout: "",
        stderr: "Command failed",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toBe("Error: Command failed");
    });

    it("should handle execution exceptions", async () => {
      mockPi.exec.mockRejectedValue(new Error("Exec failed"));

      const result = await registeredTool.execute("tool1", {}, vi.fn(), {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Error analyzing dependencies");
    });
  });
});
