import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  generateWorkspaceName,
  parseWorkspaceList,
  parseDiffStats,
  getTmuxSessionStatus,
  getWorkspaceDiff,
  spawnAgent,
  loadAgentWorkspaces,
} from "./workspace";

type ExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

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
    let execMock: ReturnType<typeof vi.fn>;
    let pi: ExtensionAPI;

    beforeEach(() => {
      execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
      pi = { exec: execMock } as unknown as ExtensionAPI;
    });

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
    let execMock: ReturnType<typeof vi.fn>;
    let pi: ExtensionAPI;

    beforeEach(() => {
      execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
      pi = { exec: execMock } as unknown as ExtensionAPI;
    });

    describe("when file path contains single quotes", () => {
      it("then escapes file argument safely and returns diff", async () => {
        execMock
          .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
          .mockResolvedValueOnce({
            code: 0,
            stdout: "diff output",
            stderr: "",
          });

        const result = await getWorkspaceDiff(
          pi,
          "/repo/.jj/workspaces/ide-abc",
          "src/o'reilly.ts",
        );

        expect(result).toBe("diff output");
        expect(execMock).toHaveBeenNthCalledWith(
          2,
          "bash",
          [
            "-c",
            "set -o pipefail; jj diff --git --color=never -r @ 'src/o'\"'\"'reilly.ts' | diff-so-fancy",
          ],
          { cwd: "/repo/.jj/workspaces/ide-abc" },
        );
      });
    });

    describe("when diff command fails", () => {
      it("then returns actionable error with stderr details", async () => {
        execMock
          .mockResolvedValueOnce({ code: 0, stdout: "", stderr: "" })
          .mockResolvedValueOnce({
            code: 1,
            stdout: "",
            stderr: "pipe failed",
          });

        const result = await getWorkspaceDiff(
          pi,
          "/repo/.jj/workspaces/ide-abc",
        );

        expect(result).toBe("Failed to get diff: pipe failed");
      });
    });
  });

  describe("given subagent spawning", () => {
    let execMock: ReturnType<typeof vi.fn>;
    let pi: ExtensionAPI;

    beforeEach(() => {
      execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>();
      pi = { exec: execMock } as unknown as ExtensionAPI;
    });

    describe("when session path and quoted task are provided", () => {
      it("then builds tmux command with escaped task and session argument", async () => {
        execMock.mockResolvedValue({ code: 0, stdout: "", stderr: "" });

        await spawnAgent(
          pi,
          "/repo/.jj/workspaces/ide-abc",
          "ide-abc",
          'fix "discard" flow',
          "/repo/.pi/sessions/child.json",
        );

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
          spawnAgent(pi, "/repo/.jj/workspaces/ide-abc", "ide-abc", "task"),
        ).rejects.toThrow("Failed to spawn agent: tmux failed");
      });
    });
  });

  describe("given agent workspace aggregation", () => {
    describe("when ide and non-ide workspaces are listed", () => {
      it("then returns only ide workspaces with status and file stats", async () => {
        const execMock = vi.fn<(...args: unknown[]) => Promise<ExecResult>>(
          async (command: unknown, args: unknown) => {
            const cmd = String(command);
            const argList = (args as string[]) ?? [];

            if (
              cmd === "jj" &&
              argList[0] === "workspace" &&
              argList[1] === "list"
            ) {
              return {
                code: 0,
                stdout:
                  "ide-abc: znvxvkwopwql feat: ✨ add\nother: qwerty not ide\n",
                stderr: "",
              };
            }

            if (
              cmd === "jj" &&
              argList[0] === "workspace" &&
              argList[1] === "root"
            ) {
              return { code: 0, stdout: "/repo\n", stderr: "" };
            }

            if (cmd === "tmux" && argList[0] === "has") {
              return { code: 0, stdout: "", stderr: "" };
            }

            if (cmd === "tmux" && argList[0] === "list-panes") {
              return { code: 0, stdout: "pi\n", stderr: "" };
            }

            if (
              cmd === "jj" &&
              argList[0] === "diff" &&
              argList[1] === "--stat"
            ) {
              return {
                code: 0,
                stdout: " a.ts | 2 ++\n b.ts | 1 -\n",
                stderr: "",
              };
            }

            return { code: 1, stdout: "", stderr: "unexpected call" };
          },
        );

        const pi = { exec: execMock } as unknown as ExtensionAPI;

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
