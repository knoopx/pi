import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockGist } from "../../../shared/testing/test-factories";
import type { Gist } from "./gist";
import { formatGist, formatGistUpdate, getGist, listGists } from "./gist";
import { mockGhCmd, mockGhCmdJson } from "../../../shared/testing/test-factories";

describe("formatGist", () => {
  it("includes gist URL", () => {
    const output = formatGist(createMockGist() as unknown as Gist);
    expect(output).toContain("https://gist.github.com/abc123");
  });

  it("includes description when present", () => {
    const output = formatGist(createMockGist() as unknown as Gist);
    expect(output).toContain("Test gist");
  });

  it("shows 'No description' for null description", () => {
    const output = formatGist(
      createMockGist({ description: null }) as unknown as Gist,
    );
    expect(output).toContain("No description");
  });

  it("formats file listing with size and language", () => {
    const output = formatGist(createMockGist() as unknown as Gist);
    expect(output).toContain("main.ts");
    expect(output).toContain("0.5 KB");
    expect(output).toContain("TypeScript");
  });

  it("handles multiple files", () => {
    const gist = createMockGist({
      files: {
        "a.ts": {
          filename: "a.ts",
          type: "text",
          language: null,
          content: "",
          raw_url: "",
          size: 100,
        },
        "b.py": {
          filename: "b.py",
          type: "text",
          language: "Python",
          content: "",
          raw_url: "",
          size: 200,
        },
      },
    });
    const output = formatGist(gist as unknown as Gist);
    expect(output).toContain("a.ts");
    expect(output).toContain("b.py");
  });

  it("shows 'plain text' for null language", () => {
    const gist = createMockGist({
      files: {
        "readme.txt": {
          filename: "readme.txt",
          type: "text",
          language: null,
          content: "",
          raw_url: "",
          size: 100,
        },
      },
    });
    const output = formatGist(gist as unknown as Gist);
    expect(output).toContain("plain text");
  });

  it("includes created and updated dates", () => {
    const output = formatGist(createMockGist() as unknown as Gist);
    expect(output).toContain("2024");
  });
});

describe("formatGistUpdate", () => {
  it("shows update confirmation with URL", () => {
    const output = formatGistUpdate(createMockGist() as unknown as Gist);
    expect(output).toContain("✓ Gist updated: https://gist.github.com/abc123");
  });

  it("includes description", () => {
    const output = formatGistUpdate(createMockGist() as unknown as Gist);
    expect(output).toContain("Test gist");
  });

  it("lists files with size and language", () => {
    const output = formatGistUpdate(createMockGist() as unknown as Gist);
    expect(output).toContain("• main.ts (0.5 KB, TypeScript)");
  });

  it("handles null description", () => {
    const output = formatGistUpdate(
      createMockGist({ description: null }) as unknown as Gist,
    );
    expect(output).toContain("No description");
  });
});

describe("getGist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ghCmdJson with correct endpoint", async () => {
    mockGhCmdJson.mockResolvedValue(createMockGist());
    const result = await getGist("abc123");
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      ["api", "/gists/abc123"],
      "api gist",
    );
    expect(result).toBeDefined();
  });

  it("returns the gist from api response", async () => {
    mockGhCmdJson.mockResolvedValue(createMockGist({ id: "xyz789" }));
    const result = await getGist("xyz789");
    expect(result.id).toBe("xyz789");
  });
});

describe("listGists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls ghCmdJson for a specific user", async () => {
    mockGhCmdJson.mockResolvedValue([]);
    await listGists("octocat", 10);
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      [
        "api",
        "/users/octocat/gists?per_page=10",
        "--jq",
        "[.[] | {id, description, public, created_at, updated_at, html_url, files, user: (.owner // null)}]",
      ],
      "api gists",
    );
  });

  it("falls back to ghCmd for @me", async () => {
    mockGhCmd.mockResolvedValue({
      exitCode: 0,
      stdout: "abc123\n",
      stderr: "",
    });
    mockGhCmdJson.mockResolvedValue(createMockGist());

    const result = await listGists("@me", 5);
    expect(result).toBeDefined();
  });

  it("uses default limit of 30", async () => {
    mockGhCmdJson.mockResolvedValue([]);
    await listGists("someuser");
    expect(mockGhCmdJson).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining("per_page=30")]),
      "api gists",
    );
  });
});
