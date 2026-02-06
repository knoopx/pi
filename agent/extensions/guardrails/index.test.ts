import { describe, it, expect, vi, beforeEach } from "vitest";
import guardrailsExtension, {
  isGroupActive,
  registerSettingsCommand,
} from "./index";
import { configLoader } from "./config";

// Mock dependencies
vi.mock("./config", () => ({
  configLoader: {
    load: vi.fn(),
    getConfig: vi.fn(),
    getGlobalConfig: vi.fn(),
    saveGlobal: vi.fn(),
  },
}));

vi.mock("./ui/group-editor", () => ({
  GroupEditor: vi.fn(),
}));

vi.mock("tinyglobby", () => ({
  glob: vi.fn(),
}));

const { glob } = await import("tinyglobby");
const { GroupEditor } = await import("./ui/group-editor");

describe("Guardrails Extension", () => {
  const mockConfigLoader = vi.mocked(configLoader);
  const mockGlob = vi.mocked(glob);
  const _mockGroupEditor = vi.mocked(GroupEditor);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isGroupActive", () => {
    describe("given pattern is '*'", () => {
      it("then returns true", async () => {
        const result = await isGroupActive("*", "/test");

        expect(result).toBe(true);
      });
    });

    describe("given pattern matches files", () => {
      beforeEach(() => {
        mockGlob.mockResolvedValue(["package.json"]);
      });

      it("then returns true", async () => {
        const result = await isGroupActive("*.json", "/test");

        expect(result).toBe(true);
        expect(mockGlob).toHaveBeenCalledWith(["*.json"], {
          cwd: "/test",
          absolute: false,
          dot: true,
          onlyDirectories: false,
        });
      });
    });

    describe("given pattern matches no files", () => {
      beforeEach(() => {
        mockGlob.mockResolvedValue([]);
      });

      it("then returns false", async () => {
        const result = await isGroupActive("*.lock", "/test");

        expect(result).toBe(false);
      });
    });

    describe("given glob throws error", () => {
      beforeEach(() => {
        mockGlob.mockRejectedValue(new Error("Permission denied"));
      });

      it("then returns false", async () => {
        const result = await isGroupActive("*.txt", "/test");

        expect(result).toBe(false);
      });
    });
  });

  describe("guardrailsExtension", () => {
    describe("given valid config", () => {
      beforeEach(() => {
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "coreutils",
            pattern: "*",
            rules: [
              {
                context: "command",
                pattern: "^find",
                action: "block",
                reason: "use `fd` instead",
              },
            ],
          },
        ]);
      });

      it("then loads config and sets up hooks", async () => {
        const mockPI = {
          on: vi.fn(),
          registerCommand: vi.fn(),
        };

        await guardrailsExtension(mockPI as any);

        expect(mockConfigLoader.load).toHaveBeenCalled();
        expect(mockConfigLoader.getConfig).toHaveBeenCalled();
        expect(mockPI.on).toHaveBeenCalledWith(
          "tool_call",
          expect.any(Function),
        );
        expect(mockPI.registerCommand).toHaveBeenCalledWith(
          "guardrails",
          expect.any(Object),
        );
      });
    });
  });

  describe("registerSettingsCommand", () => {
    describe("given pi instance", () => {
      it("then registers guardrails command", () => {
        const mockPI = {
          registerCommand: vi.fn(),
        };

        registerSettingsCommand(mockPI as any);

        expect(mockPI.registerCommand).toHaveBeenCalledWith("guardrails", {
          description: "Configure guardrails groups",
          handler: expect.any(Function),
        });
      });
    });

    describe("when command handler is called with UI", () => {
      it("then loads global config and shows editor", async () => {
        const mockPI = {
          registerCommand: vi.fn(),
        };

        registerSettingsCommand(mockPI as any);

        const commandHandler = mockPI.registerCommand.mock.calls[0][1].handler;
        const mockCtx = {
          hasUI: true,
          ui: {
            custom: vi.fn().mockReturnValue({}),
            notify: vi.fn(),
          },
        };

        mockConfigLoader.getGlobalConfig.mockReturnValue([]);

        await commandHandler([], mockCtx);

        expect(mockConfigLoader.getGlobalConfig).toHaveBeenCalled();
        expect(mockCtx.ui.custom).toHaveBeenCalled();
      });
    });

    describe("when command handler is called without UI", () => {
      it("then returns early without showing editor", async () => {
        const mockPI = {
          registerCommand: vi.fn(),
        };

        registerSettingsCommand(mockPI as any);

        const commandHandler = mockPI.registerCommand.mock.calls[0][1].handler;
        const mockCtx = {
          hasUI: false,
          ui: {
            custom: vi.fn(),
            notify: vi.fn(),
          },
        };

        await commandHandler([], mockCtx);

        expect(mockCtx.ui.custom).not.toHaveBeenCalled();
      });
    });
  });

  describe("Rule Enforcement Integration", () => {
    describe("given coreutils blocking rules", () => {
      beforeEach(() => {
        // Mock config loader
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "coreutils",
            pattern: "*",
            rules: [
              {
                context: "command",
                pattern: "^find",
                action: "block",
                reason: "use `fd` instead",
              },
            ],
          },
        ]);

        // Mock glob to return matches (group is active)
        mockGlob.mockResolvedValue(["package.json"]);
      });

      describe("when find command is executed", () => {
        it("then blocks the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          // Get the tool_call handler
          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          expect(toolCallHandler).toBeDefined();

          const mockEvent = {
            toolName: "bash",
            input: { command: "find . -name '*.ts'" },
          };

          const mockCtx = {
            cwd: "/test/project",
            hasUI: true,
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toEqual({
            block: true,
            reason: expect.stringContaining("Blocked:"),
          });
          expect(mockCtx.ui.notify).toHaveBeenCalledWith(
            expect.stringContaining("Blocked:"),
            "error",
          );
        });
      });

      describe("when allowed command is executed", () => {
        it("then allows the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "ls -la" },
          };

          const mockCtx = {
            cwd: "/test/project",
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toBeUndefined();
          expect(mockCtx.ui.notify).not.toHaveBeenCalled();
        });
      });
    });

    describe("given inactive groups", () => {
      beforeEach(() => {
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "bun-specific",
            pattern: "bun.lock",
            rules: [
              {
                context: "command",
                pattern: "^npm",
                action: "block",
                reason: "use `bun` instead",
              },
            ],
          },
        ]);

        // Mock glob to return no matches (group is inactive)
        mockGlob.mockResolvedValue([]);
      });

      describe("when npm command is executed in non-bun project", () => {
        it("then allows the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "npm install lodash" },
          };

          const mockCtx = {
            cwd: "/test/project",
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toBeUndefined();
          expect(mockCtx.ui.notify).not.toHaveBeenCalled();
        });
      });
    });

    describe("given lock file blocking rules", () => {
      beforeEach(() => {
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "lock-files",
            pattern: "*",
            rules: [
              {
                context: "file_name",
                pattern: "(package-lock\\.json|bun\\.lockb)",
                action: "block",
                reason:
                  "auto-generated lock files should not be edited directly",
              },
            ],
          },
        ]);

        mockGlob.mockResolvedValue(["package.json"]);
      });

      describe("when editing package-lock.json", () => {
        it("then blocks the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "edit",
            input: {
              path: "package-lock.json",
              oldText: "old content",
              newText: "new content",
            },
          };

          const mockCtx = {
            cwd: "/test/project",
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toEqual({
            block: true,
            reason:
              "Blocked: auto-generated lock files should not be edited directly",
          });
        });
      });

      describe("when reading package.json", () => {
        it("then allows the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "read",
            input: { path: "package.json" },
          };

          const mockCtx = {
            cwd: "/test/project",
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toBeUndefined();
        });
      });
    });

    describe("given TypeScript content blocking rules", () => {
      beforeEach(() => {
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "typescript",
            pattern: "tsconfig.json",
            rules: [
              {
                context: "file_content",
                pattern: "@ts-ignore",
                action: "block",
                reason: "`@ts-ignore` comments are not allowed",
              },
            ],
          },
        ]);

        // Mock tsconfig.json exists
        mockGlob.mockResolvedValue(["tsconfig.json"]);
      });

      describe("when writing file with @ts-ignore", () => {
        it("then blocks the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "write",
            input: {
              path: "src/index.ts",
              content: "// @ts-ignore\nconst x: any = {};",
            },
          };

          const mockCtx = {
            cwd: "/test/project",
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toEqual({
            block: true,
            reason: "Blocked: `@ts-ignore` comments are not allowed",
          });
        });
      });
    });

    describe("given confirm action rules", () => {
      beforeEach(() => {
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "dangerous",
            pattern: "*",
            rules: [
              {
                context: "command",
                pattern: "^rm ",
                action: "confirm",
                reason: "This command deletes files",
              },
            ],
          },
        ]);

        mockGlob.mockResolvedValue(["package.json"]);
      });

      describe("when dangerous command is executed and user confirms", () => {
        it("then allows the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "rm -rf /tmp/test" },
          };

          const mockCtx = {
            cwd: "/test/project",
            hasUI: true,
            ui: {
              notify: vi.fn(),
              custom: vi.fn().mockResolvedValue(true), // User confirms
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toBeUndefined(); // Operation allowed
          expect(mockCtx.ui.custom).toHaveBeenCalled();
        });
      });

      describe("when dangerous command is executed and user denies", () => {
        it("then blocks the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "rm -rf /tmp/test" },
          };

          const mockCtx = {
            cwd: "/test/project",
            hasUI: true,
            ui: {
              notify: vi.fn(),
              custom: vi.fn().mockResolvedValue(false), // User denies
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toEqual({
            block: true,
            reason: "Blocked: User denied dangerous operation",
          });
        });
      });

      describe("when dangerous command is executed without UI", () => {
        it("then blocks automatically", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "rm -rf /tmp/test" },
          };

          const mockCtx = {
            cwd: "/test/project",
            hasUI: false,
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toEqual({
            block: true,
            reason: expect.stringContaining("no UI for confirmation"),
          });
          expect(mockCtx.ui.custom).not.toHaveBeenCalled();
        });
      });
    });

    describe("given rules with includes pattern", () => {
      beforeEach(() => {
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "includes-test",
            pattern: "*",
            rules: [
              {
                context: "command",
                pattern: "^find",
                includes: "--delete",
                action: "block",
                reason: "find with --delete is dangerous",
              },
            ],
          },
        ]);

        mockGlob.mockResolvedValue(["package.json"]);
      });

      describe("when command matches pattern and includes", () => {
        it("then blocks the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "find . -name '*.tmp' --delete" },
          };

          const mockCtx = {
            cwd: "/test/project",
            hasUI: true,
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toEqual({
            block: true,
            reason: "Blocked: find with --delete is dangerous",
          });
        });
      });

      describe("when command matches pattern but not includes", () => {
        it("then allows the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "find . -name '*.ts'" },
          };

          const mockCtx = {
            cwd: "/test/project",
            hasUI: true,
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toBeUndefined();
        });
      });
    });

    describe("given rules with excludes pattern", () => {
      beforeEach(() => {
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "excludes-test",
            pattern: "*",
            rules: [
              {
                context: "command",
                pattern: "^find",
                excludes: "\\| head",
                action: "block",
                reason: "use `fd` instead",
              },
            ],
          },
        ]);

        mockGlob.mockResolvedValue(["package.json"]);
      });

      describe("when command matches pattern but also excludes", () => {
        it("then allows the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "find . -name '*.ts' | head -20" },
          };

          const mockCtx = {
            cwd: "/test/project",
            hasUI: true,
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toBeUndefined();
        });
      });

      describe("when command matches pattern and not excludes", () => {
        it("then blocks the operation", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "find . -name '*.ts'" },
          };

          const mockCtx = {
            cwd: "/test/project",
            hasUI: true,
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          expect(result).toEqual({
            block: true,
            reason: "Blocked: use `fd` instead",
          });
        });
      });
    });

    describe("given malformed regex patterns", () => {
      beforeEach(() => {
        mockConfigLoader.load.mockResolvedValue();
        mockConfigLoader.getConfig.mockReturnValue([
          {
            group: "broken",
            pattern: "*",
            rules: [
              {
                context: "command",
                pattern: "[invalid regex",
                action: "block",
                reason: "This pattern is broken",
              },
            ],
          },
        ]);

        mockGlob.mockResolvedValue(["package.json"]);
      });

      describe("when command is executed", () => {
        it("then skips malformed regex gracefully", async () => {
          const mockPI = {
            on: vi.fn(),
            registerCommand: vi.fn(),
          };

          await guardrailsExtension(mockPI as any);

          const toolCallHandler = mockPI.on.mock.calls.find(
            (call) => call[0] === "tool_call",
          )?.[1];

          const mockEvent = {
            toolName: "bash",
            input: { command: "some command" },
          };

          const mockCtx = {
            cwd: "/test/project",
            ui: {
              notify: vi.fn(),
              custom: vi.fn(),
            },
          };

          const result = await toolCallHandler(mockEvent, mockCtx);

          // Malformed regex should be skipped, no blocking
          expect(result).toBeUndefined();
        });
      });
    });
  });
});
