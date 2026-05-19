import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Mock node:fs before importing the module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

import * as fs from "node:fs";

const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
const mockMkdirSync = fs.mkdirSync as ReturnType<typeof vi.fn>;
const mockWriteFileSync = fs.writeFileSync as ReturnType<typeof vi.fn>;

import setupWriteGuard, { countLines, buildRefusalRecipe } from "./index";

function createMockPI() {
  return {
    registerTool: vi.fn(),
    on: vi.fn(),
  } as unknown as ExtensionAPI;
}

describe("countLines", () => {
  it("returns 0 for empty string", () => {
    expect(countLines("")).toBe(0);
  });

  it("returns 1 for single line without newline", () => {
    expect(countLines("hello")).toBe(1);
  });

  it("returns 1 for single line with trailing newline", () => {
    expect(countLines("hello\n")).toBe(1);
  });

  it("counts multiple lines with trailing newline", () => {
    expect(countLines("a\nb\nc\n")).toBe(3);
  });

  it("counts multiple lines without trailing newline", () => {
    expect(countLines("a\nb\nc")).toBe(3);
  });

  it("handles only newlines", () => {
    expect(countLines("\n\n\n")).toBe(3);
  });

  it("handles single newline", () => {
    expect(countLines("\n")).toBe(1);
  });
});

describe("buildRefusalRecipe", () => {
  it("includes the file path", () => {
    const recipe = buildRefusalRecipe("/path/to/file.ts");
    expect(recipe).toContain("/path/to/file.ts");
  });

  it("starts with Write refused message", () => {
    const recipe = buildRefusalRecipe("test.txt");
    expect(recipe).toMatch(/^Error: Write refused — test\.txt/);
  });

  it("includes Edit tool recipe", () => {
    const recipe = buildRefusalRecipe("x.ts");
    expect(recipe).toContain('{"name": "Edit"');
    expect(recipe).toContain('"old_string"');
    expect(recipe).toContain('"new_string"');
  });

  it("instructs to Read the file first", () => {
    const recipe = buildRefusalRecipe("x.ts");
    expect(recipe).toContain("Read it first");
  });

  it("warns against retrying Write", () => {
    const recipe = buildRefusalRecipe("x.ts");
    expect(recipe).toContain("Do NOT retry Write");
  });

  it("suggests multiple Edit calls for multiple changes", () => {
    const recipe = buildRefusalRecipe("x.ts");
    expect(recipe).toContain("multiple Edit calls");
  });
});

describe("write tool registration", () => {
  let mockPi: ReturnType<typeof createMockPI>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPi = createMockPI();
    setupWriteGuard(mockPi);
  });

  it("registers the write tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledTimes(1);
  });

  it("uses correct tool name", () => {
    const tool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(tool.name).toBe("write");
  });

  it("has label and description", () => {
    const tool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(tool.label).toBe("Write");
    expect(tool.description).toContain("NEW file");
    expect(tool.description).toContain("Refuses if the file already exists");
  });

  it("defines file_path and content parameters", () => {
    const tool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(tool.parameters).toBeDefined();
  });
});

describe("write tool execution", () => {
  let execute: (
    toolCallId: string,
    params: { file_path: string; content: string },
  ) => Promise<unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReset();
    mockMkdirSync.mockReset();
    mockWriteFileSync.mockReset();

    const mockPi = createMockPI();
    setupWriteGuard(mockPi);
    const tool = (mockPi.registerTool as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    execute = tool.execute;
  });

  describe("given file already exists", () => {
    it("returns refusal error with Edit recipe", async () => {
      mockExistsSync.mockReturnValue(true);
      const result = await execute("call-1", {
        file_path: "/existing/file.ts",
        content: "new content",
      });

      expect(result).toHaveProperty("content");
      const text = (result as { content: [{ text: string }] }).content[0].text;
      expect(text).toContain("Write refused");
      expect(text).toContain("/existing/file.ts");
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("does not attempt to write", async () => {
      mockExistsSync.mockReturnValue(true);
      await execute("call-1", {
        file_path: "/existing/file.ts",
        content: "new content",
      });

      expect(mockMkdirSync).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe("given file does not exist", () => {
    it("creates parent directories recursively", async () => {
      mockExistsSync.mockReturnValue(false);
      await execute("call-1", {
        file_path: "/new/dir/file.ts",
        content: "content",
      });

      expect(mockMkdirSync).toHaveBeenCalledWith("/new/dir", {
        recursive: true,
      });
    });

    it("writes the file with utf-8 encoding", async () => {
      mockExistsSync.mockReturnValue(false);
      await execute("call-1", {
        file_path: "/new/file.ts",
        content: "hello world",
      });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        "/new/file.ts",
        "hello world",
        { encoding: "utf-8" },
      );
    });

    it("returns success message with line count", async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await execute("call-1", {
        file_path: "/new/file.ts",
        content: "line1\nline2\nline3\n",
      });

      expect(result).toHaveProperty("content");
      const text = (result as { content: [{ text: string }] }).content[0].text;
      expect(text).toContain("Created /new/file.ts");
      expect(text).toContain("3 lines");
    });

    it("returns correct line count without trailing newline", async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await execute("call-1", {
        file_path: "/new/file.ts",
        content: "line1\nline2",
      });

      const text = (result as { content: [{ text: string }] }).content[0].text;
      expect(text).toContain("2 lines");
    });

    it("returns 0 lines for empty content", async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await execute("call-1", {
        file_path: "/new/file.ts",
        content: "",
      });

      const text = (result as { content: [{ text: string }] }).content[0].text;
      expect(text).toContain("0 lines");
    });
  });

  describe("given write fails", () => {
    it("returns error result with message", async () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error("EACCES: permission denied");
      });

      const result = await execute("call-1", {
        file_path: "/readonly/file.ts",
        content: "content",
      });

      expect(result).toHaveProperty("content");
      const text = (result as { content: [{ text: string }] }).content[0].text;
      expect(text).toContain("Error:");
      expect(text).toContain("permission denied");
    });
  });
});
