/**
 * Snapshot tests for core-tools (find) tool output.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createMockExtensionAPI } from "../../shared/test-utils";
import type { MockExtensionAPI, MockTool } from "../../shared/test-utils";

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

describe("core-tools output snapshots", () => {
  let mockPi: MockExtensionAPI;
  let tool: MockTool;

  beforeEach(async () => {
    mockPi = createMockExtensionAPI();
    const { default: ext } = await import("./index");
    ext(mockPi as ExtensionAPI);
    tool = mockPi.registerTool.mock.calls.find(
      (c) => c[0].name === "find",
    )![0] as MockTool;
  });

  it("renders no-files-found output", async () => {
    const { spawn } = await import("child_process");
    const mockChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);

    const promise = tool.execute(
      "id",
      { pattern: "*.nonexistent" },
      undefined,
      undefined,
      {},
    );

    const closeHandler = mockChild.on.mock.calls.find(
      (c) => c[0] === "close",
    )![1];
    closeHandler(0);

    const result = await promise;
    expect((result.content[0] as { text: string }).text).toBe(
      "No files found matching pattern",
    );
  });

  it("renders file results output", async () => {
    const { spawn } = await import("child_process");
    const mockChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);

    const promise = tool.execute(
      "id",
      { pattern: "*.ts" },
      undefined,
      undefined,
      {},
    );

    const dataHandler = mockChild.stdout.on.mock.calls.find(
      (c) => c[0] === "data",
    )![1];
    dataHandler(
      Buffer.from(
        `${process.cwd()}/src/index.ts\n${process.cwd()}/src/utils.ts\n`,
      ),
    );

    const closeHandler = mockChild.on.mock.calls.find(
      (c) => c[0] === "close",
    )![1];
    closeHandler(0);

    const result = await promise;
    expect((result.content[0] as { text: string }).text).toBe(
      "src/index.ts\nsrc/utils.ts",
    );
  });

  it("renders timeout abort output", async () => {
    const { spawn } = await import("child_process");
    const mockChild = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    (spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockChild);

    vi.useFakeTimers();
    const promise = tool.execute(
      "id",
      { pattern: "*" },
      undefined,
      undefined,
      {},
    );

    vi.advanceTimersByTime(1100);
    vi.useRealTimers();

    const result = await promise;
    expect((result.content[0] as { text: string }).text).toBe(
      'Search aborted: exceeded 1000ms timeout. The pattern "*" is too broad — use a more specific glob or target a subdirectory.',
    );
  });
});
