import { describe, it, expect, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createNewChange } from "./changes";

function createMockPI(
  execResponses: { code: number; stdout: string; stderr?: string }[],
): ExtensionAPI {
  let callIndex = 0;
  return {
    exec: vi.fn(() => {
      const response = execResponses[callIndex++] ?? { code: 0, stdout: "" };
      return Promise.resolve(response);
    }),
  } as unknown as ExtensionAPI;
}

describe("createNewChange", () => {
  it("creates a new revision when file changes exist", async () => {
    const mockPI = createMockPI([
      { code: 0, stdout: "changed\n" }, // hasFileChanges
      { code: 0, stdout: "" }, // jj new
      { code: 0, stdout: "abc123\n" }, // jj log for change id
    ]);

    const result = await createNewChange(
      mockPI as never,
      "/project",
      "fix(auth): handle null pointer",
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(true);
    expect(result.changeId).toBe("abc123");
    const execMock = mockPI.exec as unknown as { mock: { calls: unknown[][] } };
    expect(execMock.mock.calls[0][1]).toEqual([
      "log",
      "-r",
      "@",
      "--no-graph",
      "-T",
      'if(empty, "empty", "changed") ++ "\n"',
    ]);
    expect(execMock.mock.calls[1][1]).toContain("new");
    expect(execMock.mock.calls[1][1]).toContain("-m");
    expect(execMock.mock.calls[1][1]).toContain(
      "fix(auth): handle null pointer",
    );
  });

  it("returns early with no changes and no description", async () => {
    const mockPI = createMockPI([
      { code: 0, stdout: "empty\n" }, // hasFileChanges
    ]);

    const result = await createNewChange(mockPI as never, "/project");

    expect(result.success).toBe(true);
    expect(result.created).toBe(false);
    const execMock = mockPI.exec as unknown as { mock: { calls: unknown[][] } };
    expect(execMock.mock.calls.length).toBe(1);
  });

  it("describes current revision when no changes but description provided", async () => {
    const mockPI = createMockPI([
      { code: 0, stdout: "empty\n" }, // hasFileChanges
      { code: 0, stdout: "" }, // jj describe
    ]);

    const result = await createNewChange(
      mockPI as never,
      "/project",
      "fix(auth): handle null pointer",
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(false);
    const execMock = mockPI.exec as unknown as { mock: { calls: unknown[][] } };
    expect(execMock.mock.calls.length).toBe(2);
    expect(execMock.mock.calls[1][1]).toEqual([
      "describe",
      "-m",
      "fix(auth): handle null pointer",
    ]);
  });

  it("returns failure when jj describe fails", async () => {
    const mockPI = createMockPI([
      { code: 0, stdout: "empty\n" }, // hasFileChanges
      { code: 1, stdout: "", stderr: "jj describe failed" }, // jj describe
    ]);

    const result = await createNewChange(
      mockPI as never,
      "/project",
      "fix(auth): handle null pointer",
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("jj describe failed");
    expect(result.created).toBe(false);
  });

  it("returns early when jj log fails to check changes", async () => {
    const mockPI = createMockPI([
      { code: 1, stdout: "", stderr: "jj log failed" }, // hasFileChanges
    ]);

    const result = await createNewChange(
      mockPI as never,
      "/project",
      "fix(auth): handle null pointer",
    );

    expect(result.success).toBe(true);
    expect(result.created).toBe(false);
  });
});
