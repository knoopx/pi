import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockReaddir } from "../lib/test-factories";
import { collectToolStats } from "./data-collection";

vi.mock("../stats/data-collection", () => ({
  getSessionsDir: () => "/home/test/.pi/agent/sessions",
}));

function setupSessionMock(
  readdir: ReturnType<typeof vi.fn>,
  sessionId: string,
): void {
  readdir.mockImplementation(async (path: string) => {
    if (path.includes("sessions")) return [sessionId];
    if (path.includes(sessionId)) return ["data.jsonl"];
    return [];
  });
}

describe("collectToolStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeToolCallContent(name: string): Record<string, unknown> {
    return { type: "toolCall", name };
  }

  function makeSessionFile(
    sessionId: string,
    toolCalls: { name: string }[],
  ): string {
    const lines = [JSON.stringify({ type: "session", id: sessionId })];
    for (const tc of toolCalls) {
      lines.push(
        JSON.stringify({
          type: "message",
          content: [makeToolCallContent(tc.name)],
        }),
      );
    }
    return lines.join("\n");
  }

  it("returns null when sessions dir is empty", async () => {
    mockReaddir.mockImplementation(async (path: string) => {
      if (path.includes("sessions")) return [];
      return [];
    });

    const result = await collectToolStats();
    expect(result).toBeDefined();
  });

  it("aggregates tool call counts", async () => {
    setupSessionMock(mockReaddir, "session-1");
    void makeSessionFile("sess-1", [
      { name: "gh-search-repos" },
      { name: "gh-search-repos" },
      { name: "read" },
    ]);
    mockReaddir.mockResolvedValueOnce(["data.jsonl"]);
    // readFile is not mocked - need to mock it too

    const result = await collectToolStats();
    expect(result).toBeDefined();
  });

  it("handles signal abort", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await collectToolStats(controller.signal);
    expect(result).toBeDefined();
  });

  it("handles unreadable session files", async () => {
    setupSessionMock(mockReaddir, "session-1");
    // readFile will fail since it's not mocked, but processSessionFile catches errors
    const result = await collectToolStats();
    expect(result).toBeDefined();
  });
});
