import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  AgentToolResult,
  ExtensionAPI,
} from "@mariozechner/pi-coding-agent";
import type { MockTool, MockExtensionAPI } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";
import setupPiSessionToolsExtension, {
  decodeSessionPath,
  setSessionsDir,
} from "./index";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function jsonl(...lines: unknown[]): string {
  return lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
}

const SESSION_HEADER = {
  type: "session",
  version: 3,
  id: "test-session-1",
  timestamp: "2026-03-01T10:00:00.000Z",
  cwd: "/home/user/myproject",
};

const USER_MSG = {
  type: "message",
  id: "m1",
  parentId: null,
  timestamp: "2026-03-01T10:00:10.000Z",
  message: {
    role: "user",
    content: [{ type: "text", text: "list all files in src" }],
    timestamp: 1772542810000,
  },
};

const ASSISTANT_TOOL_CALL = {
  type: "message",
  id: "m2",
  parentId: "m1",
  timestamp: "2026-03-01T10:00:12.000Z",
  message: {
    role: "assistant",
    content: [
      { type: "text", text: "I'll list the files for you." },
      {
        type: "toolCall",
        id: "tc1",
        name: "bash",
        arguments: { command: "ls src/" },
      },
    ],
    timestamp: 1772542812000,
  },
};

const TOOL_RESULT_OK = {
  type: "message",
  id: "m3",
  parentId: "m2",
  timestamp: "2026-03-01T10:00:14.000Z",
  message: {
    role: "toolResult",
    toolCallId: "tc1",
    toolName: "bash",
    isError: false,
    content: [{ type: "text", text: "index.ts\nutils.ts\nconfig.ts" }],
    timestamp: 1772542814000,
  },
};

const TOOL_RESULT_ERROR = {
  type: "message",
  id: "m3e",
  parentId: "m2",
  timestamp: "2026-03-01T10:00:14.000Z",
  message: {
    role: "toolResult",
    toolCallId: "tc1",
    toolName: "bash",
    isError: true,
    content: [{ type: "text", text: "ls: cannot access 'src/': No such file" }],
    timestamp: 1772542814000,
  },
};

const BASH_EXECUTION = {
  type: "message",
  id: "m4",
  parentId: null,
  timestamp: "2026-03-01T10:00:20.000Z",
  message: {
    role: "bashExecution",
    command: "git status",
    output: "On branch main\nnothing to commit",
    exitCode: 0,
    cancelled: false,
    truncated: false,
    timestamp: 1772542820000,
    excludeFromContext: false,
  },
};

const ASSISTANT_TEXT = {
  type: "message",
  id: "m5",
  parentId: "m3",
  timestamp: "2026-03-01T10:00:16.000Z",
  message: {
    role: "assistant",
    content: [
      {
        type: "text",
        text: "Found 3 files in src: index.ts, utils.ts, config.ts",
      },
    ],
    timestamp: 1772542816000,
  },
};

const SESSION_2_HEADER = {
  type: "session",
  version: 3,
  id: "test-session-2",
  timestamp: "2026-03-02T08:00:00.000Z",
  cwd: "/home/user/myproject",
};

const SESSION_2_USER = {
  type: "message",
  id: "s2m1",
  parentId: null,
  timestamp: "2026-03-02T08:00:05.000Z",
  message: {
    role: "user",
    content: [{ type: "text", text: "run the tests" }],
    timestamp: 1772611205000,
  },
};

describe("Pi Session Tools Extension", () => {
  let mockPi: MockExtensionAPI;
  let tmpDir: string;
  let projectDir: string;

  function getTool(name: string): MockTool {
    return mockPi.registerTool.mock.calls.find(
      (call) => (call[0] as MockTool).name === name,
    )![0] as MockTool;
  }

  function exec(tool: MockTool, params: unknown, cwd = "/home/user/myproject") {
    return tool.execute("t1", params, undefined, undefined, { cwd });
  }

  function textOf(result: AgentToolResult<Record<string, unknown>>): string {
    const firstText = result.content.find(
      (item): item is { type: "text"; text: string } =>
        item.type === "text" && typeof item.text === "string",
    );

    expect(firstText).toBeDefined();
    return firstText!.text;
  }

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "pi-session-test-"));
    projectDir = join(tmpDir, "--home-user-myproject--");
    await mkdir(projectDir, { recursive: true });
    setSessionsDir(tmpDir);

    mockPi = createMockExtensionAPI();
    setupPiSessionToolsExtension(mockPi as unknown as ExtensionAPI);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("given the extension is initialized", () => {
    it("then it should register all session tools", () => {
      const toolNames = mockPi.registerTool.mock.calls.map(
        (call) => (call[0] as MockTool).name,
      );
      expect(toolNames).toEqual([
        "pi-list-projects",
        "pi-list-sessions",
        "pi-session-search",
        "pi-tool-calls",
        "pi-read-session",
      ]);
    });
  });

  describe("decodeSessionPath", () => {
    it("decodes encoded directory name to absolute path", () => {
      expect(decodeSessionPath("--home-user-project--")).toBe(
        "/home/user/project",
      );
    });

    it("decodes simple path", () => {
      expect(decodeSessionPath("--tmp-test--")).toBe("/tmp/test");
    });

    it("decodes deeply nested path", () => {
      expect(decodeSessionPath("--home-knoopx-.pi-agent-extensions--")).toBe(
        "/home/knoopx/.pi/agent/extensions",
      );
    });
  });

  describe("pi-list-projects", () => {
    it("lists projects with session count and size", async () => {
      await writeFile(
        join(projectDir, "session1.jsonl"),
        jsonl(SESSION_HEADER, USER_MSG, ASSISTANT_TEXT),
      );
      const tool = getTool("pi-list-projects");
      const result = await exec(tool, {});
      expect(textOf(result)).toMatchSnapshot();
    });

    it("returns empty message when no projects", async () => {
      await rm(projectDir, { recursive: true });
      const tool = getTool("pi-list-projects");
      const result = await exec(tool, {});
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by query", async () => {
      await writeFile(
        join(projectDir, "session1.jsonl"),
        jsonl(SESSION_HEADER, USER_MSG),
      );
      const otherDir = join(tmpDir, "--home-user-other--");
      await mkdir(otherDir);
      await writeFile(
        join(otherDir, "s.jsonl"),
        jsonl({ ...SESSION_HEADER, cwd: "/home/user/other" }),
      );

      const tool = getTool("pi-list-projects");
      const result = await exec(tool, { query: "myproject" });
      expect(textOf(result)).toMatchSnapshot();
    });
  });

  describe("pi-list-sessions", () => {
    it("lists sessions with title and size", async () => {
      await writeFile(
        join(projectDir, "2026-03-01.jsonl"),
        jsonl(SESSION_HEADER, USER_MSG, ASSISTANT_TEXT),
      );
      await writeFile(
        join(projectDir, "2026-03-02.jsonl"),
        jsonl(SESSION_2_HEADER, SESSION_2_USER),
      );

      const tool = getTool("pi-list-sessions");
      const result = await exec(tool, { project: "/home/user/myproject" });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters sessions by title query", async () => {
      await writeFile(
        join(projectDir, "2026-03-01.jsonl"),
        jsonl(SESSION_HEADER, USER_MSG),
      );
      await writeFile(
        join(projectDir, "2026-03-02.jsonl"),
        jsonl(SESSION_2_HEADER, SESSION_2_USER),
      );

      const tool = getTool("pi-list-sessions");
      const result = await exec(tool, { project: "/home/user/myproject", query: "tests" });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("returns empty when no sessions", async () => {
      const tool = getTool("pi-list-sessions");
      const result = await exec(tool, { project: "/home/user/myproject" });
      expect(textOf(result)).toMatchSnapshot();
    });
  });

  describe("pi-session-search", () => {
    beforeEach(async () => {
      await writeFile(
        join(projectDir, "2026-03-01.jsonl"),
        jsonl(
          SESSION_HEADER,
          USER_MSG,
          ASSISTANT_TOOL_CALL,
          TOOL_RESULT_OK,
          ASSISTANT_TEXT,
          BASH_EXECUTION,
        ),
      );
    });

    it("returns all event types", async () => {
      const tool = getTool("pi-session-search");
      const result = await exec(tool, {
        project: "/home/user/myproject",
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-02T00:00:00Z",
      });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by role=user", async () => {
      const tool = getTool("pi-session-search");
      const result = await exec(tool, {
        project: "/home/user/myproject",
        role: "user",
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-02T00:00:00Z",
      });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by role=bash", async () => {
      const tool = getTool("pi-session-search");
      const result = await exec(tool, {
        project: "/home/user/myproject",
        role: "bash",
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-02T00:00:00Z",
      });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by role=assistant", async () => {
      const tool = getTool("pi-session-search");
      const result = await exec(tool, {
        project: "/home/user/myproject",
        role: "assistant",
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-02T00:00:00Z",
      });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by text query", async () => {
      const tool = getTool("pi-session-search");
      const result = await exec(tool, {
        project: "/home/user/myproject",
        query: "git",
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-02T00:00:00Z",
      });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by role=toolResult", async () => {
      const tool = getTool("pi-session-search");
      const result = await exec(tool, {
        project: "/home/user/myproject",
        role: "toolResult",
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-02T00:00:00Z",
      });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("searches across all projects with project='*'", async () => {
      const otherDir = join(tmpDir, "--home-user-other--");
      await mkdir(otherDir);
      await writeFile(
        join(otherDir, "2026-03-01.jsonl"),
        jsonl(
          { ...SESSION_HEADER, cwd: "/home/user/other" },
          {
            ...USER_MSG,
            message: {
              ...USER_MSG.message,
              content: [{ type: "text", text: "deploy to production" }],
            },
          },
        ),
      );

      const tool = getTool("pi-session-search");
      const result = await exec(tool, {
        project: "*",
        query: "deploy",
        from: "2026-03-01T00:00:00Z",
        to: "2026-03-02T00:00:00Z",
      });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("returns empty for out-of-range time", async () => {
      const tool = getTool("pi-session-search");
      const result = await exec(tool, {
        project: "/home/user/myproject",
        from: "2026-04-01T00:00:00Z",
        to: "2026-04-02T00:00:00Z",
      });
      expect(textOf(result)).toMatchSnapshot();
    });
  });

  describe("pi-tool-calls", () => {
    beforeEach(async () => {
      await writeFile(
        join(projectDir, "2026-03-01.jsonl"),
        jsonl(
          SESSION_HEADER,
          USER_MSG,
          ASSISTANT_TOOL_CALL,
          TOOL_RESULT_OK,
        ),
      );
    });

    it("shows tool call summary and recent calls", async () => {
      const tool = getTool("pi-tool-calls");
      const result = await exec(tool, { project: "/home/user/myproject", days: 365 });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters errors only", async () => {
      await writeFile(
        join(projectDir, "2026-03-01-err.jsonl"),
        jsonl(
          SESSION_HEADER,
          USER_MSG,
          ASSISTANT_TOOL_CALL,
          TOOL_RESULT_ERROR,
        ),
      );

      const tool = getTool("pi-tool-calls");
      const result = await exec(tool, { project: "/home/user/myproject", errorsOnly: true, days: 365 });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by tool name", async () => {
      const tool = getTool("pi-tool-calls");
      const result = await exec(tool, { project: "/home/user/myproject", tool: "bash", days: 365 });
      expect(textOf(result)).toMatchSnapshot();
    });
  });

  describe("pi-read-session", () => {
    beforeEach(async () => {
      await writeFile(
        join(projectDir, "2026-03-01.jsonl"),
        jsonl(
          SESSION_HEADER,
          USER_MSG,
          ASSISTANT_TOOL_CALL,
          TOOL_RESULT_OK,
          ASSISTANT_TEXT,
          BASH_EXECUTION,
        ),
      );
    });

    it("reads messages by session index", async () => {
      const tool = getTool("pi-read-session");
      const result = await exec(tool, { project: "/home/user/myproject", session: "0" });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("paginates with offset/limit", async () => {
      const tool = getTool("pi-read-session");
      const result = await exec(tool, { project: "/home/user/myproject", session: "0", offset: 2, limit: 2 });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by role", async () => {
      const tool = getTool("pi-read-session");
      const result = await exec(tool, { project: "/home/user/myproject", session: "0", role: "user" });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("filters by text query", async () => {
      const tool = getTool("pi-read-session");
      const result = await exec(tool, { project: "/home/user/myproject", session: "0", query: "config" });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("resolves by partial filename", async () => {
      const tool = getTool("pi-read-session");
      const result = await exec(tool, { project: "/home/user/myproject", session: "2026-03-01" });
      expect(textOf(result)).toMatchSnapshot();
    });

    it("returns error for unknown session", async () => {
      const tool = getTool("pi-read-session");
      const result = await exec(tool, { project: "/home/user/myproject", session: "nonexistent" });
      expect(textOf(result)).toMatchSnapshot();
    });
  });
});
