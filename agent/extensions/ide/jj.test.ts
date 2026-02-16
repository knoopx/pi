import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  sanitizeDescription,
  loadMutableChanges,
  listBookmarksByChange,
  loadOpLog,
  restoreFile,
} from "./jj";

interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}

describe("jj module", () => {
  describe("given description text", () => {
    describe("when sanitizing unicode and whitespace", () => {
      it("then strips non-ascii characters and normalizes spacing", () => {
        const result = sanitizeDescription(
          "feat(ide): ✨   add   op-log\tviewer",
        );
        expect(result).toBe("feat(ide): add op-log viewer");
      });
    });

    describe("when sanitizing text that becomes empty", () => {
      it("then returns fallback description", () => {
        const result = sanitizeDescription("✨🐛📚");
        expect(result).toBe("(no description)");
      });
    });
  });

  describe("given mutable changes output", () => {
    let execMock: ReturnType<typeof vi.fn>;
    let pi: ExtensionAPI;

    beforeEach(() => {
      execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
      pi = { exec: execMock } as unknown as ExtensionAPI;
    });

    describe("when jj log succeeds", () => {
      it("then parses rows and sanitizes descriptions", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout:
            "abc123\tdef456\tchanged\tAlice\t2026-02-15 14:00\tfeat(ide): ✨ add discard\n",
          stderr: "",
        });

        const result = await loadMutableChanges(pi, "/repo");

        expect(execMock).toHaveBeenCalledWith(
          "jj",
          expect.arrayContaining(["log", "-r"]),
          { cwd: "/repo" },
        );
        expect(result).toEqual([
          {
            changeId: "abc123",
            commitId: "def456",
            description: "feat(ide): add discard",
            author: "Alice",
            timestamp: "2026-02-15 14:00",
            empty: false,
          },
        ]);
      });
    });

    describe("when jj log fails", () => {
      it("then returns an empty list", async () => {
        execMock.mockResolvedValue({ code: 1, stdout: "", stderr: "error" });

        const result = await loadMutableChanges(pi, "/repo");

        expect(result).toEqual([]);
      });
    });
  });

  describe("given bookmark list output", () => {
    let execMock: ReturnType<typeof vi.fn>;
    let pi: ExtensionAPI;

    beforeEach(() => {
      execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
      pi = { exec: execMock } as unknown as ExtensionAPI;
    });

    describe("when output contains duplicate bookmarks", () => {
      it("then deduplicates and sanitizes descriptions", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout:
            "main\tabc123\tfeat: ✨ one\tAlice\nmain\tabc123\tfeat: ✨ one\tAlice\nfeature\tdef456\tfeat: ✨ two\tBob\n",
          stderr: "",
        });

        const result = await listBookmarksByChange(pi, "/repo");

        expect(result).toEqual([
          {
            bookmark: "main",
            changeId: "abc123",
            description: "feat: one",
            author: "Alice",
          },
          {
            bookmark: "feature",
            changeId: "def456",
            description: "feat: two",
            author: "Bob",
          },
        ]);
      });
    });

    describe("when jj bookmark list fails", () => {
      it("then returns an empty list", async () => {
        execMock.mockResolvedValue({ code: 1, stdout: "", stderr: "error" });

        const result = await listBookmarksByChange(pi, "/repo");

        expect(result).toEqual([]);
      });
    });
  });

  describe("given operation log output", () => {
    let execMock: ReturnType<typeof vi.fn>;
    let pi: ExtensionAPI;

    beforeEach(() => {
      execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
      pi = { exec: execMock } as unknown as ExtensionAPI;
    });

    describe("when entries contain unicode and separators", () => {
      it("then parses ids and sanitizes descriptions", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout: "op1|refactor(ide): ♻️ cleanup|extra\nop2|✨\n",
          stderr: "",
        });

        const result = await loadOpLog(pi, "/repo", 10);

        expect(result).toEqual([
          {
            opId: "op1",
            description: "refactor(ide): cleanup|extra",
          },
          {
            opId: "op2",
            description: "(no description)",
          },
        ]);
      });
    });
  });

  describe("given file discard requests", () => {
    let execMock: ReturnType<typeof vi.fn>;
    let pi: ExtensionAPI;

    beforeEach(() => {
      execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
      pi = { exec: execMock } as unknown as ExtensionAPI;
    });

    describe("when restore succeeds", () => {
      it("then uses --changes-in with the selected change id", async () => {
        execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        await restoreFile(pi, "/repo", "abc123", "src/file.ts");

        expect(execMock).toHaveBeenCalledWith(
          "jj",
          ["restore", "--changes-in", "abc123", "src/file.ts"],
          { cwd: "/repo" },
        );
      });
    });

    describe("when restore fails with stderr", () => {
      it("then throws the command error", async () => {
        execMock.mockResolvedValue({
          code: 1,
          stdout: "",
          stderr: "permission denied",
        });

        await expect(
          restoreFile(pi, "/repo", "abc123", "src/file.ts"),
        ).rejects.toThrow("permission denied");
      });
    });

    describe("when restore fails without stderr", () => {
      it("then throws a fallback error", async () => {
        execMock.mockResolvedValue({ code: 1, stdout: "", stderr: "" });

        await expect(
          restoreFile(pi, "/repo", "abc123", "src/file.ts"),
        ).rejects.toThrow("Failed to discard file changes");
      });
    });
  });
});
