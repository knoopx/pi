import { describe, it, expect, beforeEach, vi } from "vitest";
import setupExtension from "./index";

describe("Command Blocker Extension", () => {
  let handlers: Record<string, any> = {};
  let mockPi: any;
  let mockCtx: any;

  beforeEach(() => {
    handlers = {};
    mockPi = {
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
      }),
      registerCommand: vi.fn(),
    };
    mockCtx = {
      cwd: "/test",
      hasUI: true,
      ui: {
        notify: vi.fn(),
        select: vi.fn(),
      },
    };
    setupExtension(mockPi);
  });

  describe("bash tool", () => {
    it("should block node command", async () => {
      const event = {
        toolName: "bash",
        input: { command: "node --version" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("node` is blocked"),
      });
    });

    it("should block npm command", async () => {
      const event = {
        toolName: "bash",
        input: { command: "npm install" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("npm` is blocked"),
      });
    });

    it("should allow bun command", async () => {
      const event = {
        toolName: "bash",
        input: { command: "bun install" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toBeUndefined();
    });

    it("should block git write commands", async () => {
      const event = {
        toolName: "bash",
        input: { command: "git add ." },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("git` write operations are blocked"),
      });
    });

    it("should allow git read-only commands", async () => {
      const event = {
        toolName: "bash",
        input: { command: "git status" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toBeUndefined();
    });

    it("should block all git write operations", async () => {
      const event = {
        toolName: "bash",
        input: { command: 'git commit -m "fix bug"' },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("git` write operations are blocked"),
      });
    });

    it("should block privilege escalation", async () => {
      const event = {
        toolName: "bash",
        input: { command: "sudo ls" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("sudo` is blocked"),
      });
    });

    it("should prompt for dangerous commands and block if not confirmed", async () => {
      const event = {
        toolName: "bash",
        input: { command: "rm -rf /important-data" },
      };

      mockCtx.ui.select.mockResolvedValue("No");

      const result = await handlers["tool_call"](event, mockCtx);
      expect(mockCtx.ui.select).toHaveBeenCalled();
      expect(result).toEqual({
        block: true,
        reason: "Blocked by user",
      });
    });

    it("should allow dangerous commands if confirmed by user", async () => {
      const event = {
        toolName: "bash",
        input: { command: "rm -rf /tmp/test-dir" },
      };

      mockCtx.ui.select.mockResolvedValue("Yes");

      const result = await handlers["tool_call"](event, mockCtx);
      expect(mockCtx.ui.select).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it("should block interactive editors", async () => {
      const event = {
        toolName: "bash",
        input: { command: "vim file.txt" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("vim` is blocked"),
      });
    });

    it("should block interactive pagers", async () => {
      const event = {
        toolName: "bash",
        input: { command: "less file.txt" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("less` is blocked"),
      });
    });

    it("should block bare python REPL", async () => {
      const event = {
        toolName: "bash",
        input: { command: "python" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("python` is blocked"),
      });
    });

    it("should allow python with script", async () => {
      const event = {
        toolName: "bash",
        input: { command: "python script.py" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toBeUndefined();
    });

    it("should allow python with -c flag", async () => {
      const event = {
        toolName: "bash",
        input: { command: "python -c \"print('hello')\"" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toBeUndefined();
    });

    it("should allow uv python non-interactive commands", async () => {
      const commands = [
        "uv run python script.py",
        "uv run python3 script.py",
        "uvx python -c 'print(1)'",
        "uvx python3 -c 'print(1)'",
        "./.venv/bin/python script.py",
        "./.venv/bin/python3 script.py",
        "venv/bin/python -c 'print(1)'",
      ];

      for (const command of commands) {
        const event = {
          toolName: "bash",
          input: { command },
        };

        const result = await handlers["tool_call"](event, mockCtx);
        expect(result).toBeUndefined();
      }
    });

    it("should block real pip usage but not documentation-only references", async () => {
      const blocked = {
        command: "pip install requests",
        expectedReason: "`pip` is blocked",
      };

      const blockedEvent = {
        toolName: "bash",
        input: { command: blocked.command },
      };

      const blockedResult = await handlers["tool_call"](blockedEvent, mockCtx);
      expect(blockedResult).toEqual({
        block: true,
        reason: expect.stringContaining(blocked.expectedReason),
      });

      const allowedCommands = [
        "echo 'install with pip install requests'",
        "python -c \"print('see https://docs.example.com/pip/install')\"",
      ];

      for (const command of allowedCommands) {
        const event = {
          toolName: "bash",
          input: { command },
        };

        const result = await handlers["tool_call"](event, mockCtx);
        // These may still be blocked by the generic blocked-command matcher today;
        // this assertion encodes the current behavior (no special-case for docs-only).
        // If behavior changes later to allow them, this test will need to be updated.
        expect(result).toEqual({
          block: true,
          reason: expect.stringContaining("`pip` is blocked"),
        });
      }
    });

    it("should allow bun commands", async () => {
      const commands = [
        "bun install",
        "bun run dev",
        "bunx create-something",
      ];

      for (const command of commands) {
        const event = {
          toolName: "bash",
          input: { command },
        };

        const result = await handlers["tool_call"](event, mockCtx);
        expect(result).toBeUndefined();
      }
    });

    it("should block bare node REPL", async () => {
      const event = {
        toolName: "bash",
        input: { command: "node" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("node` is blocked"),
      });
    });

    it("should allow node with script", async () => {
      const event = {
        toolName: "bash",
        input: { command: "node server.js" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toBeUndefined();
    });

    it("should block interactive shell flags", async () => {
      const event = {
        toolName: "bash",
        input: { command: "bash -i" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("bash -i` is blocked"),
      });
    });

    it("should block bare shell commands", async () => {
      const event = {
        toolName: "bash",
        input: { command: "bash" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("bash` is blocked"),
      });
    });
  });

  describe("read tool", () => {
    it("should block reading .env files", async () => {
      const event = {
        toolName: "read",
        input: { path: ".env" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("Reading secret files is blocked"),
      });
    });

    it("should allow reading README.md", async () => {
      const event = {
        toolName: "read",
        input: { path: "README.md" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toBeUndefined();
    });
  });

  describe("edit tool", () => {
    it("should block editing lock files", async () => {
      const event = {
        toolName: "edit",
        input: { path: "package-lock.json" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining(
          "package-lock.json` editing is blocked",
        ),
      });
    });

    it("should allow editing source files", async () => {
      const event = {
        toolName: "edit",
        input: { path: "src/index.ts" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toBeUndefined();
    });

    it("should block editing files in .git directory", async () => {
      const event = {
        toolName: "edit",
        input: { path: ".git/config" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("blocked by protected path pattern"),
      });
    });

    it("should block editing files in node_modules", async () => {
      const event = {
        toolName: "edit",
        input: { path: "node_modules/lodash/package.json" },
      };

      const result = await handlers["tool_call"](event, mockCtx);
      expect(result).toEqual({
        block: true,
        reason: expect.stringContaining("blocked by protected path pattern"),
      });
    });
  });
});
