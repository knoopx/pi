import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFile } from "../../../shared/testing/test-factories";
import type { GHFile } from "./repo";
import {
  formatRepoContents,
  formatFileContent,
  formatRepoFilesList,
  getRepoContents,
  getFileContent,
} from "./repo";
import { mockGhCmd, mockGhCmdJson } from "../../../shared/testing/test-factories";

describe("formatRepoContents", () => {
  it("formats files with file icon and size", () => {
    const files = [
      createMockFile({ name: "src.ts", size: 512 }) as unknown as GHFile,
    ];
    const output = formatRepoContents("owner", "repo", "", files);
    expect(output).toContain("src.ts");
    expect(output).toContain("512 bytes");
  });

  it("formats directories with dir icon and no size", () => {
    const files: GHFile[] = [
      createMockFile({
        name: "lib",
        type: "dir",
        size: 0,
      }) as unknown as GHFile,
    ];
    const output = formatRepoContents("owner", "repo", "", files);
    expect(output).toContain("lib");
    expect(output).not.toContain("bytes");
  });

  it("sorts directories before files", () => {
    const files: GHFile[] = [
      createMockFile({ name: "file.ts", type: "file" }) as unknown as GHFile,
      createMockFile({ name: "src", type: "dir" }) as unknown as GHFile,
    ];
    const output = formatRepoContents("owner", "repo", "", files);
    const dirIndex = output.indexOf("src");
    const fileIndex = output.indexOf("file.ts");
    expect(dirIndex).toBeLessThan(fileIndex);
  });

  it("sorts files alphabetically within same type", () => {
    const files: GHFile[] = [
      createMockFile({ name: "z.ts", type: "file" }) as unknown as GHFile,
      createMockFile({ name: "a.ts", type: "file" }) as unknown as GHFile,
    ];
    const output = formatRepoContents("owner", "repo", "", files);
    const aIndex = output.indexOf("a.ts");
    const zIndex = output.indexOf("z.ts");
    expect(aIndex).toBeLessThan(zIndex);
  });

  it("formats empty contents list", () => {
    const output = formatRepoContents("owner", "repo", "", []);
    expect(output).toBe("");
  });
});

describe("formatFileContent", () => {
  it("returns raw content string", () => {
    const result = {
      repo: "owner/repo",
      path: "src/index.ts",
      content: "export const x = 1;",
      type: "file" as const,
    };
    expect(formatFileContent(result)).toBe("export const x = 1;");
  });
});

describe("formatRepoFilesList", () => {
  it("formats files with type icon and size", () => {
    const files = [
      createMockFile({ name: "main.ts", size: 2048 }) as unknown as GHFile,
    ];
    const result = formatRepoFilesList({
      files,
      count: 1,
      owner: "owner",
      repo: "repo",
      path: "",
    });
    expect(result).toContain("main.ts");
    expect(result).toContain("2048 B");
  });

  it("formats directories without size", () => {
    const files: GHFile[] = [
      createMockFile({
        name: "lib",
        type: "dir",
        size: 0,
      }) as unknown as GHFile,
    ];
    const result = formatRepoFilesList({
      files,
      count: 1,
      owner: "owner",
      repo: "repo",
      path: "",
    });
    expect(result).toContain("lib");
  });

  it("includes file count in header", () => {
    const files = [createMockFile() as unknown as GHFile];
    const result = formatRepoFilesList({
      files,
      count: 5,
      owner: "owner",
      repo: "repo",
      path: "",
    });
    expect(result).toContain("5 files");
  });
});

describe("getRepoContents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ghCmdJson with correct endpoint", async () => {
    mockGhCmdJson.mockResolvedValue([]);
    await getRepoContents("facebook", "react");
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      [
        "api",
        "/repos/facebook/react/contents",
        "--jq",
        "[.[] | {name, path, type, size, url, html_url, download_url: .download_url, sha}]",
      ],
      "api",
    );
  });

  it("includes path in endpoint when provided", async () => {
    mockGhCmdJson.mockResolvedValue([]);
    await getRepoContents("owner", "repo", "src");
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      expect.arrayContaining(["/repos/owner/repo/contents/src"]),
      "api",
    );
  });
});

describe("getFileContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decodes base64 content", async () => {
    const encoded = Buffer.from("hello world").toString("base64");
    mockGhCmd.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        content: encoded,
        encoding: "base64",
        type: "file",
        size: 11,
      }),
      stderr: "",
    });
    const result = await getFileContent(
      "owner",
      "repo",
      "hello.txt",
      undefined,
    );
    expect(result.content).toBe("hello world");
    expect(result.type).toBe("file");
  });

  it("throws for binary files", async () => {
    mockGhCmd.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        content: "abc",
        encoding: null,
        type: "file",
        size: 1024,
      }),
      stderr: "",
    });
    await expect(
      getFileContent("owner", "repo", "binary.bin", undefined),
    ).rejects.toThrow("File is binary");
  });

  it("throws 404 for missing files", async () => {
    mockGhCmd.mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "API error: 404 Not Found",
    });
    await expect(
      getFileContent("owner", "repo", "missing.txt", undefined),
    ).rejects.toThrow("File not found");
  });

  it("includes ref in endpoint when provided", async () => {
    mockGhCmd.mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({
        content: Buffer.from("test").toString("base64"),
        encoding: "base64",
        type: "file",
        size: 4,
      }),
      stderr: "",
    });
    await getFileContent("owner", "repo", "file.txt", "main");
    expect(mockGhCmd).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("ref=main")]),
    );
  });
});
