import { beforeEach, describe, expect, it } from "vitest";
import { getRawDiff } from "./jj/files";
import {
  generateWorkspaceName,
  parseWorkspaceList,
  parseDiffStats,
  getTmuxSessionStatus,
  spawnAgent,
  loadAgentWorkspaces,
} from "./workspace";
import { createMockExecPi, createMockExecPiWithRoutes } from "./lib/test-utils";

const { execMock, pi } = createMockExecPi();
beforeEach(() => execMock.mockReset());

describe("workspace module", () => {
  describe("given workspace name generation", () => {
    describe("when generating a name", () => {
      it("then returns ide-prefixed identifier", () => {
        const result = generateWorkspaceName();

        expect(result.startsWith("ide-")).toBe(true);
        expect(result).toMatch(/^ide-[a-z0-9]+-[a-z0-9]{4}$/);
      });
    });
  });

  describe("given jj workspace list output", () => {
    describe("when parsing valid and invalid lines", () => {
      it("then returns parsed entries and sanitizes unicode descriptions", () => {
        const output = [
          "ide-abc: znvxvkwopwql feat(ide): ✨ add discard",
          "invalid line without separators",
          "ide-def: abc123 ♻️   refactor  parser",
        ].join("\n");

        const result = parseWorkspaceList(output);

        expect(result).toEqual([
          {
            name: "ide-abc",
            changeId: "znvxvkwopwql",
            description: "feat(ide): add discard",
          },
          {
            name: "ide-def",
            changeId: "abc123",
            description: "refactor parser",
          },
        ]);
      });
    });

    describe("when description contains only unicode symbols", () => {
      it("then uses fallback description", () => {
        const output = "ide-abc: znvxvkwopwql ✨🐛";

        const result = parseWorkspaceList(output);

        expect(result[0]?.description).toBe("(no description)");
      });
    });
  });

  describe("given diff stat output", () => {
    describe("when parsing file additions, modifications, and deletions", () => {
      it("then computes per-file status and totals", () => {
        const output = [
          " src/new.ts | 4 ++++",
          " src/changed.ts | 5 ++---",
          " src/old.ts | 2 --",
          " 3 files changed, 6 insertions(+), 5 deletions(-)",
        ].join("\n");

        const result = parseDiffStats(output);

        expect(result.files).toEqual([
          { path: "src/new.ts", status: "added", insertions: 4, deletions: 0 },
          {
            path: "src/changed.ts",
            status: "modified",
            insertions: 2,
            deletions: 3,
          },
          {
            path: "src/old.ts",
            status: "deleted",
            insertions: 0,
            deletions: 2,
          },
        ]);
        expect(result.totalInsertions).toBe(6);
        expect(result.totalDeletions).toBe(5);
      });
    });
  });

  describe("given tmux session checks", () => {
    describe("when tmux session does not exist", () => {
      it("then reports completed status", async () => {
        execMock.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "" });

        const result = await getTmuxSessionStatus(pi, "ide-abc");

        expect(result).toBe("completed");
      });
    });

    describe("when session exists and agent command is active", () => {
      it("then reports running status", async () => {
        execMock
          .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
          .mockResolvedValueOnce({ code: 0, stdout: "bun\n", stderr: "" });

        const result = await getTmuxSessionStatus(pi, "ide-abc");

        expect(result).toBe("running");
      });
    });

    describe("when session exists but pane query fails", () => {
      it("then reports idle status", async () => {
        execMock
          .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
          .mockResolvedValueOnce({ code: 1, stdout: "", stderr: "failed" });

        const result = await getTmuxSessionStatus(pi, "ide-abc");

        expect(result).toBe("idle");
      });
    });
  });

  describe("given workspace diff loading", () => {
    describe("when file path contains single quotes", () => {
      it("then returns diff with files", async () => {
        execMock
          .mockResolvedValueOnce({
            code: 0,
            stdout: "",
            stderr: "",
          })
          .mockResolvedValueOnce({
            code: 0,
            stdout: "",
            stderr: "",
          })
          .mockResolvedValueOnce({
            code: 0,
            stdout: "diff output",
            stderr: "",
          });

        const result = await getRawDiff(
          pi,
          "/repo/.jj/workspaces/ide-abc",
          "@",
          "src/o'reilly.ts",
        );

        expect(result.diff).toBe("diff output");
        expect(Array.isArray(result.files)).toBe(true);
      });
    });

    describe("when diff command fails", () => {
      it("then throws error with stderr details", async () => {
        execMock
          .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
          .mockResolvedValueOnce({
            code: 1,
            stdout: "",
            stderr: "pipe failed",
          });

        await expect(
          getRawDiff(pi, "/repo/.jj/workspaces/ide-abc", "@"),
        ).rejects.toThrow("Failed to get diff: pipe failed");
      });
    });
  });

  describe("given subagent spawning", () => {
    describe("when session path and quoted task are provided", () => {
      it("then builds tmux command with escaped task and session argument", async () => {
        execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        await spawnAgent({
          pi,
          workspacePath: "/repo/.jj/workspaces/ide-abc",
          sessionName: "ide-abc",
          task: 'fix "discard" flow',
          forkedSessionPath: "/repo/.pi/sessions/child.json",
        });

        expect(execMock).toHaveBeenCalledWith("tmux", [
          "new-session",
          "-d",
          "-s",
          "ide-abc",
          "-c",
          "/repo/.jj/workspaces/ide-abc",
          "bash",
          "-c",
          'pi --session "/repo/.pi/sessions/child.json" "fix \\\"discard\\\" flow"',
        ]);
      });
    });

    describe("when tmux session creation fails", () => {
      it("then throws contextual error", async () => {
        execMock.mockResolvedValue({
          code: 1,
          stdout: "",
          stderr: "tmux failed",
        });

        await expect(
          spawnAgent({
            pi,
            workspacePath: "/repo/.jj/workspaces/ide-abc",
            sessionName: "ide-abc",
            task: "task",
          }),
        ).rejects.toThrow("Failed to spawn agent: tmux failed");
      });
    });
  });

  describe("given agent workspace aggregation", () => {
    describe("when ide and non-ide workspaces are listed", () => {
      it("then returns only ide workspaces with status and file stats", async () => {
        const { pi } = createMockExecPiWithRoutes([
          {
            command: "jj",
            args: ["workspace", "list"],
            result: {
              code: 0,
              stdout:
                "ide-abc: znvxvkwopwql feat: ✨ add\nother: qwerty not ide\n",
              stderr: "",
            },
          },
          {
            command: "jj",
            args: ["workspace", "root"],
            result: { code: 0, stdout: "/repo\n", stderr: "" },
          },
          {
            command: "tmux",
            args: ["has"],
            result: { code: 0, stdout: "", stderr: "" },
          },
          {
            command: "tmux",
            args: ["list-panes"],
            result: { code: 0, stdout: "pi\n", stderr: "" },
          },
          {
            command: "jj",
            args: ["diff", "--stat"],
            result: {
              code: 0,
              stdout: " a.ts | 2 ++\n b.ts | 1 -\n",
              stderr: "",
            },
          },
        ]);

        const result = await loadAgentWorkspaces(pi);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          name: "ide-abc",
          path: "/repo/.jj/workspaces/ide-abc",
          description: "feat: add",
          status: "running",
          changeId: "znvxvkwopwql",
          fileStats: {
            added: 1,
            modified: 0,
            deleted: 1,
          },
        });
      });
    });
  });
});
