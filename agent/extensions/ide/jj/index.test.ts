import { describe, it, expect, beforeEach } from "vitest";
import { loadOpLog } from "./oplog";
import { createMockExecPi } from "../test/utils";
import { sanitizeDescription } from "./core";
import { loadChanges } from "./changes";
import { hasFileChanges } from "./changes";
import { createNewChange } from "./changes";
import { loadChangedFiles } from "./files";
import { getRawDiff } from "./files";
import { restoreFile } from "./files";
import { listBookmarksByChange } from "./bookmarks";
const { execMock, pi } = createMockExecPi();
beforeEach(() => execMock.mockReset());

async function assertEmptyOnFailure(fn: () => Promise<unknown>) {
  execMock.mockResolvedValue({ code: 1, stdout: "", stderr: "error" });
  const result = await fn();
  expect(result).toEqual([]);
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

  describe("given changes output", () => {
    describe("when jj log succeeds", () => {
      it("then parses rows and sanitizes descriptions", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout:
            "abc123\tdef456\tchanged\tmutable\tAlice\t2026-02-15 14:00\tparent1,parent2\tfeat(ide): ✨ add discard\n",
          stderr: "",
        });
        const result = await loadChanges(pi, "/repo");

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
            immutable: false,
            parentIds: ["parent1", "parent2"],
          },
        ]);
      });
    });

    describe("when jj log fails", () => {
      it("then returns an empty list", async () => {
        await assertEmptyOnFailure(() => loadChanges(pi, "/repo"));
      });
    });
  });

  describe("given bookmark list output", () => {
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
    describe("when restore succeeds", () => {
      it("then resolves repo root and uses --changes-in with the selected change id", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "/repo",
            stderr: "",
          })
          .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });

        await restoreFile(pi, "/repo", "abc123", "src/file.ts");

        expect(execMock).toHaveBeenNthCalledWith(
          1,
          "jj",
          ["workspace", "root"],
          { cwd: "/repo" },
        );
        expect(execMock).toHaveBeenNthCalledWith(
          2,
          "jj",
          ["restore", "--changes-in", "abc123", "src/file.ts"],
          { cwd: "/repo" },
        );
      });
    });

    describe("when called from a subdirectory", () => {
      it("then resolves the repo root and uses it as cwd", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "/repo",
            stderr: "",
          })
          .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });

        await restoreFile(pi, "/repo/subdir", "abc123", "src/file.ts");

        expect(execMock).toHaveBeenNthCalledWith(
          1,
          "jj",
          ["workspace", "root"],
          { cwd: "/repo/subdir" },
        );
        expect(execMock).toHaveBeenNthCalledWith(
          2,
          "jj",
          ["restore", "--changes-in", "abc123", "src/file.ts"],
          { cwd: "/repo" },
        );
      });
    });

    describe("when workspace root command fails", () => {
      it("then falls back to the original cwd", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 1,
            stdout: "",
            stderr: "not a jj repo",
          })
          .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" });

        await restoreFile(pi, "/repo", "abc123", "src/file.ts");

        expect(execMock).toHaveBeenNthCalledWith(
          2,
          "jj",
          ["restore", "--changes-in", "abc123", "src/file.ts"],
          { cwd: "/repo" },
        );
      });
    });

    describe("when restore fails with stderr", () => {
      it("then throws the command error", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "/repo",
            stderr: "",
          })
          .mockResolvedValueOnce({
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
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "/repo",
            stderr: "",
          })
          .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" });

        await expect(
          restoreFile(pi, "/repo", "abc123", "src/file.ts"),
        ).rejects.toThrow("Failed to discard file changes");
      });
    });
  });

  describe("given current jj change", () => {
    describe("when checking if change has file modifications", () => {
      describe("and current change is empty", () => {
        it("then returns false", async () => {
          execMock.mockResolvedValue({
            code: 0,
            stdout: "empty\n",
            stderr: "",
          });
          const result = await hasFileChanges(pi, "/repo");

          expect(execMock).toHaveBeenCalledWith(
            "jj",
            expect.arrayContaining(["log", "-r", "@"]),
            { cwd: "/repo" },
          );
          expect(result).toBe(false);
        });
      });

      describe("and current change has modifications", () => {
        it("then returns true", async () => {
          execMock.mockResolvedValue({
            code: 0,
            stdout: "changed\n",
            stderr: "",
          });
          const result = await hasFileChanges(pi, "/repo");

          expect(result).toBe(true);
        });
      });

      describe("when jj log fails", () => {
        it("then returns false", async () => {
          execMock.mockResolvedValue({
            code: 1,
            stdout: "",
            stderr: "not a git repo",
          });
          const result = await hasFileChanges(pi, "/repo");

          expect(result).toBe(false);
        });
      });
    });
  });

  describe("given changed files output", () => {
    describe("when jj log returns add, modify, delete statuses", () => {
      it("then parses each file with correct status and conflict flag", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout:
            "A 0 src/new.ts 0 0\nM 0 src/old.ts 0 0\nD 0 src/deleted.ts 0 0\n",
          stderr: "",
        });
        const result = await loadChangedFiles(pi, "/repo", "abc123");

        expect(result).toEqual([
          {
            status: "D",
            path: "src/deleted.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
          {
            status: "A",
            path: "src/new.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
          {
            status: "M",
            path: "src/old.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
        ]);
      });
    });

    describe("when jj log returns rename status", () => {
      it("then parses renames with the new path", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout: "R 0 src/new-name.ts 0 0\n",
          stderr: "",
        });
        const result = await loadChangedFiles(pi, "/repo", "abc123");

        expect(result).toEqual([
          {
            status: "R",
            path: "src/new-name.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
        ]);
      });
    });

    describe("when jj log returns exists and unknown statuses", () => {
      it("then parses E and ? statuses correctly", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout: "E 0 shared/lib.ts 0 0\n? 0 misc/file.json 0 0\n",
          stderr: "",
        });
        const result = await loadChangedFiles(pi, "/repo", "abc123");

        expect(result).toEqual([
          {
            status: "?",
            path: "misc/file.json",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
          {
            status: "E",
            path: "shared/lib.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
        ]);
      });
    });

    describe("when jj log fails", () => {
      it("then returns an empty list", async () => {
        await assertEmptyOnFailure(() =>
          loadChangedFiles(pi, "/repo", "abc123"),
        );
      });
    });

    describe("when jj log returns a mixed rename with other changes", () => {
      it("then parses all statuses and sorts by path", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout:
            "R 0 src/renamed.ts 0 0\nM 0 src/existing.ts 0 0\nA 0 src/new.ts 0 0\n",
          stderr: "",
        });
        const result = await loadChangedFiles(pi, "/repo", "abc123");

        expect(result).toEqual([
          {
            status: "M",
            path: "src/existing.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
          {
            status: "A",
            path: "src/new.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
          {
            status: "R",
            path: "src/renamed.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
        ]);
      });
    });

    describe("when jj log returns copied files", () => {
      it("then parses copied files normally (C=status, not conflict)", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout:
            "A 0 src/new.ts 0 0\nC 0 src/copied.ts 0 0\nM 0 src/old.ts 0 0\n",
          stderr: "",
        });
        const result = await loadChangedFiles(pi, "/repo", "abc123");

        expect(result).toEqual([
          {
            status: "C",
            path: "src/copied.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
          {
            status: "A",
            path: "src/new.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
          {
            status: "M",
            path: "src/old.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
        ]);
      });
    });

    describe("when jj log returns conflicted files", () => {
      it("then puts conflicted files first via f.target().conflict()", async () => {
        execMock.mockResolvedValue({
          code: 0,
          stdout:
            "A 0 src/new.ts 0 0\nM 1 z-conflict.ts 0 0\nM 0 src/old.ts 0 0\nM 1 a-conflict.ts 0 0\n",
          stderr: "",
        });
        const result = await loadChangedFiles(pi, "/repo", "abc123");

        expect(result).toEqual([
          {
            status: "M",
            path: "a-conflict.ts",
            insertions: 0,
            deletions: 0,
            conflicted: true,
          },
          {
            status: "M",
            path: "z-conflict.ts",
            insertions: 0,
            deletions: 0,
            conflicted: true,
          },
          {
            status: "A",
            path: "src/new.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
          {
            status: "M",
            path: "src/old.ts",
            insertions: 0,
            deletions: 0,
            conflicted: false,
          },
        ]);
      });
    });
  });

  describe("given session start", () => {
    describe("when current change is empty", () => {
      it("then does not create new change and returns created=false", async () => {
        execMock.mockResolvedValueOnce({
          code: 0,
          stdout: "empty\n",
          stderr: "",
        });
        const result = await createNewChange(pi, "/repo");

        expect(result).toEqual({ success: true, created: false });
        expect(execMock).toHaveBeenCalledTimes(1);
      });
    });

    describe("when current change has modifications", () => {
      describe("and jj new succeeds", () => {
        it("then creates new change and returns change id", async () => {
          execMock
            .mockResolvedValueOnce({
              code: 0,
              stdout: "changed\n",
              stderr: "",
            })
            .mockResolvedValueOnce({
              code: 0,
              stdout: "",
              stderr: "",
            })
            .mockResolvedValueOnce({
              code: 0,
              stdout: "newchange123\n",
              stderr: "",
            });
          const result = await createNewChange(pi, "/repo");

          expect(result).toEqual({
            success: true,
            changeId: "newchange123",
            created: true,
          });
          expect(execMock).toHaveBeenCalledTimes(3);
        });
      });

      describe("and jj new fails", () => {
        it("then returns success=false with error", async () => {
          execMock
            .mockResolvedValueOnce({
              code: 0,
              stdout: "changed\n",
              stderr: "",
            })
            .mockResolvedValueOnce({
              code: 1,
              stdout: "",
              stderr: "worktree locked",
            });
          const result = await createNewChange(pi, "/repo");

          expect(result).toEqual({
            success: false,
            created: false,
            error: "worktree locked",
          });
        });
      });

      describe("and jj log fails after new", () => {
        it("then returns success=true with created=true but no change id", async () => {
          execMock
            .mockResolvedValueOnce({
              code: 0,
              stdout: "changed\n",
              stderr: "",
            })
            .mockResolvedValueOnce({
              code: 0,
              stdout: "",
              stderr: "",
            })
            .mockResolvedValueOnce({
              code: 1,
              stdout: "",
              stderr: "error",
            });
          const result = await createNewChange(pi, "/repo");

          expect(result).toEqual({
            success: true,
            created: true,
          });
        });
      });
    });
  });

  describe("given raw diff requests", () => {
    describe("when getting diff for all files in a change", () => {
      it("then uses the original cwd", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "",
            stderr: "",
          })
          .mockResolvedValueOnce({
            code: 0,
            stdout:
              "diff --git a/src/file.ts b/src/file.ts\n@@ -1 +1 @@\n-old\n+new\n",
            stderr: "",
          });
        const result = await getRawDiff(pi, "/repo", "abc123");

        expect(execMock).toHaveBeenNthCalledWith(
          2,
          "jj",
          ["diff", "--git", "-r", "abc123"],
          { cwd: "/repo" },
        );
        expect(result.files).toContain("src/file.ts");
      });
    });

    describe("when getting diff for a specific file from a subdirectory", () => {
      it("then resolves the repo root and uses it as cwd", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "",
            stderr: "",
          })
          .mockResolvedValueOnce({
            code: 0,
            stdout: "/repo",
            stderr: "",
          })
          .mockResolvedValueOnce({
            code: 0,
            stdout:
              "diff --git a/src/file.ts b/src/file.ts\n@@ -1 +1 @@\n-old\n+new\n",
            stderr: "",
          });
        const result = await getRawDiff(
          pi,
          "/repo/subdir",
          "abc123",
          "src/file.ts",
        );

        expect(execMock).toHaveBeenNthCalledWith(
          3,
          "jj",
          ["diff", "--git", "-r", "abc123", "src/file.ts"],
          { cwd: "/repo" },
        );
        expect(result.files).toContain("src/file.ts");
      });
    });

    describe("when workspace root command fails", () => {
      it("then falls back to the original cwd", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "",
            stderr: "",
          })
          .mockResolvedValueOnce({
            code: 1,
            stdout: "",
            stderr: "not a jj repo",
          })
          .mockResolvedValueOnce({
            code: 0,
            stdout: "diff --git a/file.ts b/file.ts\n",
            stderr: "",
          });

        await getRawDiff(pi, "/repo", "abc123", "file.ts");

        expect(execMock).toHaveBeenNthCalledWith(
          3,
          "jj",
          ["diff", "--git", "-r", "abc123", "file.ts"],
          { cwd: "/repo" },
        );
      });
    });

    describe("when jj diff fails", () => {
      it("then throws an error with stderr message", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "",
            stderr: "",
          })
          .mockResolvedValueOnce({
            code: 1,
            stdout: "",
            stderr: "no such file",
          });

        await expect(getRawDiff(pi, "/repo", "abc123")).rejects.toThrow(
          "Failed to get diff: no such file",
        );
      });
    });
  });
});
