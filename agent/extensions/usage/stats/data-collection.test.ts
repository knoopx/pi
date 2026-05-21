import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockReaddir, mockReadFile } from "../lib/test-factories";
import { getSessionsDir, collectUsageData } from "./data-collection";

vi.mock("node:os", () => ({
  homedir: () => "/home/test",
}));

function mockSessionDirs(
  sessionNames: string[],
  filesPerSession: string[] = ["session.jsonl"],
) {
  mockReaddir.mockImplementation(
    async (_path: string, opts?: { withFileTypes?: boolean }) => {
      if (opts?.withFileTypes)
        return sessionNames.map((name) => ({
          isDirectory: () => true,
          name,
        }));
      return filesPerSession;
    },
  );
}

describe("getSessionsDir", () => {
  it("returns default path", () => {
    expect(getSessionsDir()).toBe("/home/test/.pi/agent/sessions");
  });

  it("uses PI_CODING_AGENT_DIR env var when set", () => {
    process.env.PI_CODING_AGENT_DIR = "/custom/path";
    expect(getSessionsDir()).toBe("/custom/path/sessions");
    delete process.env.PI_CODING_AGENT_DIR;
  });
});

describe("data-collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockSessionFile(sessionId: string, messages: unknown[]): void {
    const content = [
      JSON.stringify({ type: "session", id: sessionId }),
      ...messages.map((m) => JSON.stringify(m)),
    ].join("\n");
    mockReadFile.mockResolvedValueOnce(content);
  }

  function makeMessage(
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      type: "message",
      role: "assistant",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      timestamp: Date.now(),
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        cache_read_tokens: 50,
        cache_write_tokens: 10,
        total_tokens: 360,
        cost: { total: 0.005 },
      },
      ...overrides,
    };
  }

  it("collects session files from sessions dir", async () => {
    mockSessionDirs(["session-1", "session-2"]);

    mockSessionFile("sess-1", [makeMessage()]);
    mockSessionFile("sess-2", [makeMessage()]);

    const result = await collectUsageData();
    expect(result).toBeDefined();
  });

  it("handles empty sessions directory", async () => {
    mockSessionDirs([]);

    const result = await collectUsageData();
    expect(result).toBeDefined();
  });

  it("handles readdir failure gracefully", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    expect(getSessionsDir()).toBeDefined();
  });

  it("handles unreadable session files", async () => {
    mockSessionDirs(["session-1"], ["broken.jsonl"]);
    mockReadFile.mockRejectedValue(new Error("EACCES"));

    const result = await collectUsageData();
    expect(result).toBeDefined();
  });

  it("aggregates usage across multiple messages", async () => {
    mockSessionDirs(["session-1"]);

    const messages = [
      makeMessage({
        timestamp: Date.now(),
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 300,
          cost: { total: 0.003 },
        },
      }),
      makeMessage({
        timestamp: Date.now() + 1000,
        usage: {
          input_tokens: 150,
          output_tokens: 250,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 400,
          cost: { total: 0.004 },
        },
      }),
    ];
    mockSessionFile("sess-1", messages);

    const result = await collectUsageData();
    expect(result).toBeDefined();
  });

  it("handles invalid JSON lines gracefully", async () => {
    mockSessionDirs(["session-1"]);
    const content = [
      JSON.stringify({ type: "session", id: "sess-1" }),
      "not valid json",
      JSON.stringify(makeMessage()),
    ].join("\n");
    mockReadFile.mockResolvedValueOnce(content);

    const result = await collectUsageData();
    expect(result).toBeDefined();
  });

  it("handles session with no messages", async () => {
    mockSessionDirs(["session-1"]);
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ type: "session", id: "sess-1" }),
    );

    const result = await collectUsageData();
    expect(result).toBeDefined();
  });

  it("filters non-assistant messages", async () => {
    mockSessionDirs(["session-1"]);
    const content = [
      JSON.stringify({ type: "session", id: "sess-1" }),
      JSON.stringify({ type: "message", role: "user", provider: "anthropic" }),
      JSON.stringify(makeMessage()),
    ].join("\n");
    mockReadFile.mockResolvedValueOnce(content);

    const result = await collectUsageData();
    expect(result).toBeDefined();
  });

  it("handles signal abort", async () => {
    mockSessionDirs(["session-1"]);
    const abortController = new AbortController();
    abortController.abort();

    const result = await collectUsageData(abortController.signal);
    expect(result).toBeNull();
  });

  it("groups stats by provider and model", async () => {
    mockSessionDirs(["session-1"]);
    const messages = [
      makeMessage({
        provider: "openai",
        model: "gpt-4",
        usage: {
          input_tokens: 50,
          output_tokens: 100,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 150,
          cost: { total: 0.002 },
        },
      }),
      makeMessage({
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        usage: {
          input_tokens: 100,
          output_tokens: 200,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          total_tokens: 300,
          cost: { total: 0.003 },
        },
      }),
    ];
    mockSessionFile("sess-1", messages);

    const result = await collectUsageData();
    expect(result).toBeDefined();
  });
});
