import { describe, it, expect, beforeEach, vi } from "vitest";
import setupMarkitdownExtension from "./index";

describe("Markitdown Extension", () => {
  let mockPi: any;

  beforeEach(() => {
    mockPi = {
      registerTool: vi.fn(),
      exec: vi.fn(),
    };
    setupMarkitdownExtension(mockPi);
  });

  it("should register convert-to-markdown tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "transcribe",
        label: "Transcribe",
      }),
    );
  });

  describe("convert-to-markdown tool", () => {
    let registeredTool: any;

    beforeEach(() => {
      registeredTool = mockPi.registerTool.mock.calls[0][0];
    });

    it("should convert file successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout:
          "# Converted Markdown Content\n\nThis is the converted content.",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const onUpdate = vi.fn();

      const result = await registeredTool.execute(
        "tool1",
        {
          source: "/path/to/file.pdf",
        },
        onUpdate,
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "markitdown",
        ["/path/to/file.pdf"],
        { signal: undefined },
      );
      expect(onUpdate).toHaveBeenCalledWith({
        status: "Converting /path/to/file.pdf to Markdown...",
      });
      expect(result.content[0].text).toBe(
        "# Converted Markdown Content\n\nThis is the converted content.",
      );
      expect(result.details).toEqual({
        source: "/path/to/file.pdf",
        converted: true,
      });
    });

    it("should convert URL successfully", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "# Webpage Title\n\nContent from the webpage.",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        {
          source: "https://example.com/page",
        },
        vi.fn(),
        {},
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "markitdown",
        ["https://example.com/page"],
        { signal: undefined },
      );
      expect(result.content[0].text).toBe(
        "# Webpage Title\n\nContent from the webpage.",
      );
      expect(result.details.converted).toBe(true);
    });

    it("should handle conversion errors", async () => {
      const mockResult = {
        exitCode: 1,
        stdout: "",
        stderr: "markitdown: file not found",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const result = await registeredTool.execute(
        "tool1",
        {
          source: "/nonexistent/file.pdf",
        },
        vi.fn(),
        {},
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(
        "Error converting source: markitdown: file not found",
      );
      expect(result.details.error).toBe("markitdown: file not found");
    });

    it("should handle execution errors", async () => {
      mockPi.exec.mockRejectedValue(new Error("Command not found"));

      const result = await registeredTool.execute(
        "tool1",
        {
          source: "/path/to/file.pdf",
        },
        vi.fn(),
        {},
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(
        /Unexpected error:.*Command not found/,
      );
      expect(result.details.error).toBe("Error: Command not found");
    });

    it("should pass signal to exec", async () => {
      const mockResult = {
        exitCode: 0,
        stdout: "Converted content",
        stderr: "",
      };
      mockPi.exec.mockResolvedValue(mockResult);

      const abortController = new AbortController();
      const signal = abortController.signal;

      await registeredTool.execute(
        "tool1",
        {
          source: "/path/to/file.pdf",
        },
        vi.fn(),
        {},
        signal,
      );

      expect(mockPi.exec).toHaveBeenCalledWith(
        "markitdown",
        ["/path/to/file.pdf"],
        { signal },
      );
    });
  });
});
