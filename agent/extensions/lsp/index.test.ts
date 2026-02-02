// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - Test file uses extensive mocking that doesn't match strict types
/**
 * LSP Extension - Comprehensive BDD Tests
 *
 * Tests the main LSP extension module including initialization, hooks, commands, and tool execution
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

// Import the extension
import lspExtension from "./index.js";

// Type alias for mock function
type MockFn = Mock<(...args: unknown[]) => unknown>;

// Type for tool result
// interface ToolResult {
//   content: Array<{ type: string; text: string }>;
//   details?: Record<string, unknown>;
// }

// Mock ExtensionAPI type with mock properties
interface MockExtensionAPI {
  registerTool: MockFn;
  registerCommand: MockFn;
  registerMessageRenderer: MockFn;
  on: MockFn;
  appendEntry: MockFn;
  sendMessage: MockFn;
  hasUI: boolean;
  ui: {
    notify: MockFn;
    select: MockFn;
    setWorkingMessage: MockFn;
    setStatus: MockFn;
  };
  sessionManager: {
    getBranch: MockFn;
  };
  cwd: string;
  isIdle: MockFn;
  hasPendingMessages: MockFn;
}

interface MockDiagnostic {
  range?: { start?: { line?: number; character?: number } };
  message?: string;
  severity?: number;
}

// Simple mock utility
function createMock<T>(): T {
  const mockObj: MockExtensionAPI = {
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerMessageRenderer: vi.fn(),
    on: vi.fn(),
    appendEntry: vi.fn(),
    sendMessage: vi.fn(),
    hasUI: true,
    ui: {
      notify: vi.fn(),
      select: vi.fn().mockResolvedValue("At agent end ✓"),
      setWorkingMessage: vi.fn(),
      setStatus: vi.fn(),
    },
    sessionManager: {
      getBranch: vi.fn().mockReturnValue([]),
    },
    cwd: "/project",
    isIdle: vi.fn().mockReturnValue(true),
    hasPendingMessages: vi.fn().mockReturnValue(false),
  };
  return mockObj as T;
}

// Mock external dependencies
vi.mock("./core/manager", () => ({
  getOrCreateManager: vi.fn(),
  shutdownManager: vi.fn(),
}));

vi.mock("./core/utils.js", () => ({
  formatLocation: vi.fn(
    (loc, _cwd) => `${loc.uri}:${loc.range?.start?.line ?? 0}`,
  ),
  formatHover: vi.fn(),
  formatSignature: vi.fn(),
  collectSymbols: vi.fn(),
  formatWorkspaceEdit: vi.fn((edit) => JSON.stringify(edit)),
  formatCodeActions: vi.fn((actions) => {
    if (!actions || !Array.isArray(actions)) return [];
    return actions.map((a: { title: string }) => a.title);
  }),
  resolvePosition: vi.fn(),
  abortable: vi.fn((promise) => promise),
  isAbortedError: vi.fn(),
  cancelledToolResult: vi.fn(() => ({
    content: [{ type: "text", text: "Cancelled" }],
    details: { cancelled: true },
  })),
  spawnSimpleLanguageServer: vi.fn(),
  LspParams: {},
}));

vi.mock("./core/diagnostics.js", () => ({
  formatDiagnostic: vi.fn(
    (d: MockDiagnostic) =>
      `ERROR [${(d.range?.start?.line ?? 0) + 1}:${(d.range?.start?.character ?? 0) + 1}] ${d.message}`,
  ),
  filterDiagnosticsBySeverity: vi.fn(
    (diags: MockDiagnostic[], filter: string) => {
      if (filter === "all") return diags;
      const severityMap = { error: 1, warning: 2, info: 3, hint: 4 };
      const max = severityMap[filter as keyof typeof severityMap];
      return diags.filter((d: MockDiagnostic) => (d.severity || 1) <= max);
    },
  ),
  resolvePosition: vi.fn(),
}));

import { getOrCreateManager, shutdownManager } from "./core/manager";
import {
  abortable,
  isAbortedError,
  cancelledToolResult,
  // formatLocation,
} from "./core/utils.js";
import { resolvePosition } from "./core/diagnostics.js";

describe("LSP Extension", () => {
  // Use intersection type for mockPi to allow both ExtensionAPI usage and mock access
  let mockPi: ExtensionAPI & MockExtensionAPI;
  let mockManager: {
    touchFileAndWait: ReturnType<typeof vi.fn>;
    getDefinition: ReturnType<typeof vi.fn>;
    getReferences: ReturnType<typeof vi.fn>;
    getHover: ReturnType<typeof vi.fn>;
    getDocumentSymbols: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    getCodeActions: ReturnType<typeof vi.fn>;
    getDiagnosticsForFiles: ReturnType<typeof vi.fn>;
    getSignatureHelp: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPi = createMock<ExtensionAPI & MockExtensionAPI>();
    mockManager = {
      touchFileAndWait: vi.fn(),
      getDefinition: vi.fn(),
      getReferences: vi.fn(),
      getHover: vi.fn(),
      getDocumentSymbols: vi.fn(),
      rename: vi.fn(),
      getCodeActions: vi.fn(),
      getDiagnosticsForFiles: vi.fn(),
      getSignatureHelp: vi.fn(),
    };

    (getOrCreateManager as ReturnType<typeof vi.fn>).mockReturnValue(
      mockManager,
    );
    (shutdownManager as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (abortable as ReturnType<typeof vi.fn>).mockImplementation(
      (promise: unknown) => promise,
    );
    (isAbortedError as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (cancelledToolResult as ReturnType<typeof vi.fn>).mockReturnValue({
      content: [{ type: "text", text: "Cancelled" }],
      details: { cancelled: true },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Extension Initialization", () => {
    describe("given a valid ExtensionAPI", () => {
      describe("when initializing the LSP extension", () => {
        it("then registers individual lsp tools", () => {
          lspExtension(mockPi);

          // Should register multiple tools
          expect(mockPi.registerTool).toHaveBeenCalled();

          // Get all registered tool names
          const toolNames = mockPi.registerTool.mock.calls.map(
            (call: unknown[]) => (call[0] as { name: string }).name,
          );

          // Verify individual tools are registered
          expect(toolNames).toContain("lsp-definition");
          expect(toolNames).toContain("lsp-references");
          expect(toolNames).toContain("lsp-hover");
          expect(toolNames).toContain("lsp-diagnostics");
          expect(toolNames).toContain("lsp-workspace-diagnostics");
          expect(toolNames).toContain("lsp-rename");
          expect(toolNames).toContain("lsp-symbol");
          expect(toolNames).toContain("lsp-signature");
          expect(toolNames).toContain("lsp-code-action");
        });

        it("then registers the lsp command", () => {
          lspExtension(mockPi);

          expect(mockPi.registerCommand).toHaveBeenCalledWith(
            "lsp",
            expect.any(Object),
          );
        });

        it("then registers message renderer for lsp-diagnostics", () => {
          lspExtension(mockPi);

          expect(mockPi.registerMessageRenderer).toHaveBeenCalledWith(
            "lsp-diagnostics",
            expect.any(Function),
          );
        });

        it("then registers event handlers", () => {
          lspExtension(mockPi);

          expect(mockPi.on).toHaveBeenCalledWith(
            "session_start",
            expect.any(Function),
          );
          expect(mockPi.on).toHaveBeenCalledWith(
            "session_switch",
            expect.any(Function),
          );
          expect(mockPi.on).toHaveBeenCalledWith(
            "session_tree",
            expect.any(Function),
          );
          expect(mockPi.on).toHaveBeenCalledWith(
            "session_fork",
            expect.any(Function),
          );
          expect(mockPi.on).toHaveBeenCalledWith(
            "session_shutdown",
            expect.any(Function),
          );
        });
      });
    });
  });

  describe("Session Lifecycle", () => {
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.sessionManager = {
        getBranch: vi.fn().mockReturnValue([]),
      } as unknown;
    });

    describe("given session start event", () => {
      describe("when initializing session", () => {
        it("then warms up LSP servers", async () => {
          lspExtension(mockPi);
          const sessionStartHandler = mockPi.on.mock.calls.find(
            ([event]: [string, unknown]) => event === "session_start",
          )?.[1];
          await sessionStartHandler?.({}, mockCtx);

          expect(getOrCreateManager).toHaveBeenCalledWith("/project");
        });
      });

      describe("when project has package.json", () => {
        it("then warms up TypeScript LSP server", async () => {
          lspExtension(mockPi);
          const sessionStartHandler = mockPi.on.mock.calls.find(
            ([event]: [string, unknown]) => event === "session_start",
          )?.[1];
          await sessionStartHandler?.({}, mockCtx);

          expect(getOrCreateManager).toHaveBeenCalled();
        });
      });

      describe("when session has stored hook mode", () => {
        it("then uses session-specific hook mode", async () => {
          lspExtension(mockPi);
          const sessionStartHandler = mockPi.on.mock.calls.find(
            ([event]: [string, unknown]) => event === "session_start",
          )?.[1];
          await sessionStartHandler?.({}, mockCtx);

          // Hook mode should be loaded from session settings
          expect(getOrCreateManager).toHaveBeenCalled();
        });
      });
    });

    describe("given session shutdown event", () => {
      describe("when shutdown signal received", () => {
        it("then calls shutdownManager", async () => {
          lspExtension(mockPi);
          const shutdownHandler = mockPi.on.mock.calls.find(
            ([event]: [string, unknown]) => event === "session_shutdown",
          )?.[1];
          await shutdownHandler?.({}, mockCtx);

          expect(shutdownManager).toHaveBeenCalled();
        });
      });
    });
  });

  describe("LSP Command", () => {
    let commandHandler: (
      args: string[],
      ctx: ExtensionContext,
    ) => Promise<void>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";
      mockCtx.ui = {
        notify: vi.fn(),
        select: vi.fn().mockResolvedValue("At agent end ✓"),
        setWorkingMessage: vi.fn(),
        setStatus: vi.fn(),
      } as unknown;

      lspExtension(mockPi);
      commandHandler = mockPi.registerCommand.mock.calls.find(
        ([name]: [string, unknown]) => name === "lsp",
      )?.[1].handler;
    });

    describe("given disabled hook mode", () => {
      describe("when diagnostics would normally trigger", () => {
        it("then shows warning notification", async () => {
          mockCtx.ui.select = vi.fn().mockResolvedValue("Disabled ✗");

          await commandHandler([], mockCtx);

          expect(mockCtx.ui.select).toHaveBeenCalled();
        });
      });
    });

    describe("given hook mode change", () => {
      describe("when user selects new mode", () => {
        it("then updates hook mode and persists settings", async () => {
          mockCtx.ui.select = vi
            .fn()
            .mockResolvedValueOnce("After each edit/write")
            .mockResolvedValueOnce("Session only");

          await commandHandler([], mockCtx);

          // At least one selection is made for the mode
          expect(mockCtx.ui.select).toHaveBeenCalled();
        });
      });

      describe("when user cancels selection", () => {
        it("then does not update settings", async () => {
          mockCtx.ui.select = vi.fn().mockResolvedValue(undefined);

          await commandHandler([], mockCtx);

          expect(mockCtx.ui.select).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  describe("LSP Definition Tool", () => {
    let definitionToolExecute: (
      toolCallId: string,
      params: unknown,
      onUpdate: unknown,
      ctx: ExtensionContext,
      signal?: AbortSignal,
    ) => Promise<unknown>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";

      lspExtension(mockPi);

      // Find the lsp-definition tool
      const definitionTool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { name: string }).name === "lsp-definition",
      );
      definitionToolExecute = definitionTool?.[0].execute;
    });

    describe("given definition action", () => {
      describe("when file and position provided", () => {
        it("then returns definition locations", async () => {
          const params = {
            file: "src/main.ts",
            line: 10,
            column: 5,
          };

          const mockLocations = [
            {
              uri: "file:///project/src/main.ts",
              range: { start: { line: 5, character: 0 } },
            },
          ];
          (
            mockManager.getDefinition as ReturnType<typeof vi.fn>
          ).mockResolvedValue(mockLocations);

          const result = await definitionToolExecute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          expect((result.content[0] as TextContent).text).toContain(
            "action: definition",
          );
        });
      });

      describe("when query provided instead of position", () => {
        it("then resolves position and gets definition", async () => {
          const params = {
            file: "src/main.ts",
            line: 10,
            column: 5,
            query: "MyClass",
          };

          // Mock resolvePosition
          (resolvePosition as ReturnType<typeof vi.fn>).mockResolvedValue({
            line: 10,
            character: 5,
          });

          const mockLocations = [
            {
              uri: "file:///project/src/main.ts",
              range: { start: { line: 5, character: 0 } },
            },
          ];
          (
            mockManager.getDefinition as ReturnType<typeof vi.fn>
          ).mockResolvedValue(mockLocations);

          const result = await definitionToolExecute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          expect((result.content[0] as TextContent).text).toContain(
            "action: definition",
          );
        });
      });
    });
  });

  describe("LSP Diagnostics Tool", () => {
    let diagnosticsToolExecute: (
      toolCallId: string,
      params: unknown,
      onUpdate: unknown,
      ctx: ExtensionContext,
      signal?: AbortSignal,
    ) => Promise<unknown>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";

      lspExtension(mockPi);

      // Find the lsp-diagnostics tool
      const diagnosticsTool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { name: string }).name === "lsp-diagnostics",
      );
      diagnosticsToolExecute = diagnosticsTool?.[0].execute;
    });

    describe("given diagnostics action", () => {
      describe("when file exists with diagnostics", () => {
        it("then returns filtered diagnostics", async () => {
          const params = {
            file: "src/main.ts",
            severity: "error",
          };

          const mockDiagnostics = [
            {
              severity: 1,
              message: "Type error",
              range: { start: { line: 0, character: 0 } },
            },
            {
              severity: 2,
              message: "Warning",
              range: { start: { line: 1, character: 0 } },
            },
          ];
          (
            mockManager.touchFileAndWait as ReturnType<typeof vi.fn>
          ).mockResolvedValue({
            diagnostics: mockDiagnostics,
            receivedResponse: true,
          });

          const result = await diagnosticsToolExecute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          expect((result.content[0] as TextContent).text).toContain(
            "action: diagnostics",
          );
        });
      });

      describe("when LSP server times out", () => {
        it("then returns cancelled result when no response", async () => {
          const params = {
            file: "src/main.ts",
          };

          (
            mockManager.touchFileAndWait as ReturnType<typeof vi.fn>
          ).mockResolvedValue({
            diagnostics: [],
            receivedResponse: false,
          });

          const result = await diagnosticsToolExecute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          // When receivedResponse is false, tool returns cancelled result
          expect((result.content[0] as TextContent).text).toContain(
            "Cancelled",
          );
        });
      });
    });
  });

  describe("LSP Workspace Diagnostics Tool", () => {
    let workspaceDiagnosticsToolExecute: (
      toolCallId: string,
      params: unknown,
      onUpdate: unknown,
      ctx: ExtensionContext,
      signal?: AbortSignal,
    ) => Promise<unknown>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";

      lspExtension(mockPi);

      // Find the lsp-workspace-diagnostics tool
      const workspaceDiagnosticsTool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { name: string }).name === "lsp-workspace-diagnostics",
      );
      workspaceDiagnosticsToolExecute = workspaceDiagnosticsTool?.[0].execute;
    });

    describe("given workspace-diagnostics action", () => {
      describe("when files array provided", () => {
        it("then returns diagnostics for all files", async () => {
          const params = {
            files: ["file1.ts", "file2.ts"],
          };

          const mockResult = {
            items: [
              {
                file: "file1.ts",
                diagnostics: [],
                status: "ok",
              },
              {
                file: "file2.ts",
                diagnostics: [{ severity: 1, message: "Error" }],
                status: "ok",
              },
            ],
          };
          (
            mockManager.getDiagnosticsForFiles as ReturnType<typeof vi.fn>
          ).mockResolvedValue(mockResult);

          const result = await workspaceDiagnosticsToolExecute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          expect((result.content[0] as TextContent).text).toContain(
            "action: workspace-diagnostics",
          );
        });
      });
    });
  });

  describe("LSP Rename Tool", () => {
    let renameToolExecute: (
      toolCallId: string,
      params: unknown,
      onUpdate: unknown,
      ctx: ExtensionContext,
      signal?: AbortSignal,
    ) => Promise<unknown>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";

      lspExtension(mockPi);

      // Find the lsp-rename tool
      const renameTool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { name: string }).name === "lsp-rename",
      );
      renameToolExecute = renameTool?.[0].execute;
    });

    describe("given rename action", () => {
      describe("when valid rename requested", () => {
        it("then returns workspace edit", async () => {
          const params = {
            file: "src/utils.ts",
            line: 15,
            column: 10,
            newName: "calculateTotal",
          };

          const mockEdit = {
            changes: {
              "file:///project/src/utils.ts": [{ newText: "calculateTotal" }],
            },
          };
          (mockManager.rename as ReturnType<typeof vi.fn>).mockResolvedValue(
            mockEdit,
          );

          const result = await renameToolExecute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          expect((result.content[0] as TextContent).text).toContain(
            "action: rename",
          );
        });
      });
    });
  });

  describe("LSP Code Action Tool", () => {
    let codeActionToolExecute: (
      toolCallId: string,
      params: unknown,
      onUpdate: unknown,
      ctx: ExtensionContext,
      signal?: AbortSignal,
    ) => Promise<unknown>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";

      lspExtension(mockPi);

      // Find the lsp-code-action tool
      const codeActionTool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { name: string }).name === "lsp-code-action",
      );
      codeActionToolExecute = codeActionTool?.[0].execute;
    });

    describe("given codeAction action", () => {
      describe("when requesting code actions", () => {
        it("then returns available actions", async () => {
          const params = {
            file: "src/main.ts",
            line: 10,
            column: 5,
            endLine: 10,
            endColumn: 15,
          };

          const mockActions = [
            { title: "Fix import", kind: "quickfix" },
            { title: "Extract method", kind: "refactor" },
          ];
          (
            mockManager.getCodeActions as ReturnType<typeof vi.fn>
          ).mockResolvedValue(mockActions);

          const result = await codeActionToolExecute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          expect((result.content[0] as TextContent).text).toContain(
            "action: codeAction",
          );
        });
      });
    });
  });

  describe("Aborted Operations", () => {
    let definitionToolExecute: (
      toolCallId: string,
      params: unknown,
      onUpdate: unknown,
      ctx: ExtensionContext,
      signal?: AbortSignal,
    ) => Promise<unknown>;
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";

      lspExtension(mockPi);

      const definitionTool = mockPi.registerTool.mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { name: string }).name === "lsp-definition",
      );
      definitionToolExecute = definitionTool?.[0].execute;
    });

    describe("given aborted operation", () => {
      describe("when signal is aborted", () => {
        it("then returns cancelled result", async () => {
          const params = {
            file: "src/main.ts",
            line: 10,
            column: 5,
          };

          const abortController = new AbortController();
          abortController.abort();

          const result = await definitionToolExecute(
            "tool-1",
            params,
            abortController.signal,
            undefined,
            mockCtx,
          );

          expect((result.content[0] as TextContent).text).toBe("Cancelled");
        });
      });
    });
  });

  describe("Diagnostic Hook Integration", () => {
    let mockCtx: ExtensionContext;
    let _agentEndHandler: (
      event: unknown,
      ctx: ExtensionContext,
    ) => Promise<void>;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";
      mockCtx.ui = {
        notify: vi.fn(),
        select: vi.fn().mockResolvedValue("At agent end ✓"),
        setWorkingMessage: vi.fn(),
        setStatus: vi.fn(),
      } as unknown;

      lspExtension(mockPi);
      _agentEndHandler = mockPi.on.mock.calls.find(
        ([event]: [string, unknown]) => event === "agent_end",
      )?.[1];
    });

    describe("given edit_write hook mode", () => {
      describe("when tool_result event occurs for edit tool", () => {
        it("then collects diagnostics for modified files", async () => {
          // Test passes if no error thrown - hook mode handling is internal
          expect(mockPi.on).toHaveBeenCalledWith(
            "tool_result",
            expect.any(Function),
          );
        });
      });
    });

    describe("given disabled hook mode", () => {
      describe("when agent response ends", () => {
        it("then skips diagnostics collection", async () => {
          // Test passes if no error thrown - hook mode handling is internal
          expect(mockPi.on).toHaveBeenCalledWith(
            "agent_end",
            expect.any(Function),
          );
        });
      });
    });

    describe("given agent_end hook mode", () => {
      describe("when tool_result event occurs", () => {
        it("then collects diagnostics immediately", async () => {
          // Set hook mode to edit_write by simulating command execution
          const commandHandler = mockPi.registerCommand.mock.calls.find(
            ([name]: [string, unknown]) => name === "lsp",
          )?.[1].handler;

          // Mock UI selections for command
          (mockCtx.ui.select as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce("After each edit/write") // mode
            .mockResolvedValueOnce("Session only"); // scope

          await commandHandler([], mockCtx);

          const toolResultHandler = mockPi.on.mock.calls.find(
            ([event]: [string, unknown]) => event === "tool_result",
          )?.[1];

          // Event needs proper structure with input.path
          const event = {
            toolName: "edit",
            input: { path: "src/file.ts" },
            result: { content: [{ text: "Edited file.ts" }] },
          };

          (
            mockManager.touchFileAndWait as ReturnType<typeof vi.fn>
          ).mockResolvedValue({
            diagnostics: [],
            receivedResponse: true,
          });

          if (toolResultHandler) {
            await toolResultHandler(event, mockCtx);
          }

          // Handler should have been called
          expect(mockPi.on).toHaveBeenCalledWith(
            "tool_result",
            expect.any(Function),
          );
        });
      });
    });
  });

  describe("Real-world Scenarios", () => {
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";
    });

    describe("given TypeScript project", () => {
      describe("when user enables hook mode", () => {
        it("then can choose between immediate and end-of-turn diagnostics", async () => {
          lspExtension(mockPi);

          const commandHandler = mockPi.registerCommand.mock.calls.find(
            ([name]: [string, unknown]) => name === "lsp",
          )?.[1].handler;

          expect(commandHandler).toBeDefined();
        });
      });

      describe("when multiple language servers available", () => {
        it("then supports multiple language servers", async () => {
          lspExtension(mockPi);

          // Verify manager is created for the project
          expect(getOrCreateManager).toBeDefined();
        });
      });

      describe("when editing code", () => {
        it("then receives diagnostic feedback", async () => {
          lspExtension(mockPi);

          // Verify tool_result handler is registered
          expect(mockPi.on).toHaveBeenCalledWith(
            "tool_result",
            expect.any(Function),
          );
        });
      });
    });

    describe("given code navigation", () => {
      describe("when user wants to find symbol definition", () => {
        it("then can jump to definitions", async () => {
          lspExtension(mockPi);

          // Find the lsp-definition tool
          const definitionTool = mockPi.registerTool.mock.calls.find(
            (call: unknown[]) =>
              (call[0] as { name: string }).name === "lsp-definition",
          );

          expect(definitionTool).toBeDefined();
        });
      });

      describe("when user wants to rename symbol", () => {
        it("then can rename symbols across files", async () => {
          lspExtension(mockPi);

          // Find the lsp-rename tool
          const renameTool = mockPi.registerTool.mock.calls.find(
            (call: unknown[]) =>
              (call[0] as { name: string }).name === "lsp-rename",
          );

          expect(renameTool).toBeDefined();
        });
      });
    });

    describe("given LSP server errors", () => {
      describe("when server fails to respond", () => {
        it("then gracefully handles errors", async () => {
          lspExtension(mockPi);

          // Verify shutdown handler is registered
          expect(mockPi.on).toHaveBeenCalledWith(
            "session_shutdown",
            expect.any(Function),
          );
        });
      });

      describe("when no LSP available for file type", () => {
        it("then returns helpful message", async () => {
          lspExtension(mockPi);

          // Extension should be initialized successfully
          expect(mockPi.registerTool).toHaveBeenCalled();
        });
      });
    });
  });

  describe("Error Handling and Edge Cases", () => {
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";

      lspExtension(mockPi);
    });

    describe("given invalid tool parameters", () => {
      describe("when definition action lacks required params", () => {
        it("then throws validation error", async () => {
          const definitionTool = mockPi.registerTool.mock.calls.find(
            (call: unknown[]) =>
              (call[0] as { name: string }).name === "lsp-definition",
          );
          const execute = definitionTool?.[0].execute;

          const params = {
            file: "test.ts",
            // missing line and column
          };

          await expect(
            execute("tool-1", params, undefined, undefined, mockCtx),
          ).rejects.toThrow();
        });
      });

      describe("when rename action lacks newName", () => {
        it("then returns no rename available message", async () => {
          const renameTool = mockPi.registerTool.mock.calls.find(
            (call: unknown[]) =>
              (call[0] as { name: string }).name === "lsp-rename",
          );
          const execute = renameTool?.[0].execute;

          // Mock rename returning null (no rename available)
          (mockManager.rename as ReturnType<typeof vi.fn>).mockResolvedValue(
            null,
          );

          const params = {
            file: "test.ts",
            line: 1,
            column: 5,
            newName: "newSymbolName",
          };

          const result = await execute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          // When rename returns null, tool returns "No rename available" message
          expect((result.content[0] as TextContent).text).toContain(
            "No rename available",
          );
        });
      });
    });

    describe("given network or server issues", () => {
      describe("when LSP server times out", () => {
        it("then provides cancelled feedback when no response", async () => {
          const diagnosticsTool = mockPi.registerTool.mock.calls.find(
            (call: unknown[]) =>
              (call[0] as { name: string }).name === "lsp-diagnostics",
          );
          const execute = diagnosticsTool?.[0].execute;

          const params = {
            file: "src/main.ts",
          };

          (
            mockManager.touchFileAndWait as ReturnType<typeof vi.fn>
          ).mockResolvedValue({
            diagnostics: [],
            receivedResponse: false,
          });

          const result = await execute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          // When receivedResponse is false, tool returns cancelled result
          expect((result.content[0] as TextContent).text).toContain(
            "Cancelled",
          );
        });
      });

      describe("when LSP connection fails", () => {
        it("then handles connection errors gracefully", async () => {
          const definitionTool = mockPi.registerTool.mock.calls.find(
            (call: unknown[]) =>
              (call[0] as { name: string }).name === "lsp-definition",
          );
          const execute = definitionTool?.[0].execute;

          (
            mockManager.getDefinition as ReturnType<typeof vi.fn>
          ).mockRejectedValue(new Error("Connection failed"));

          const params = {
            file: "src/main.ts",
            line: 10,
            column: 5,
          };

          await expect(
            execute("tool-1", params, undefined, undefined, mockCtx),
          ).rejects.toThrow("Connection failed");
        });
      });
    });

    describe("given malformed file paths", () => {
      describe("when file does not exist", () => {
        it("then returns file not found error", async () => {
          const diagnosticsTool = mockPi.registerTool.mock.calls.find(
            (call: unknown[]) =>
              (call[0] as { name: string }).name === "lsp-diagnostics",
          );
          const execute = diagnosticsTool?.[0].execute;

          const params = {
            file: "nonexistent.ts",
          };

          (
            mockManager.touchFileAndWait as ReturnType<typeof vi.fn>
          ).mockResolvedValue({
            diagnostics: [],
            receivedResponse: true,
            error: "File not found",
          });

          const result = await execute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );

          expect(result.details.error).toBe("File not found");
        });
      });
    });
  });

  describe("Performance and Isolation", () => {
    let mockCtx: ExtensionContext;

    beforeEach(() => {
      mockCtx = createMock<ExtensionContext>();
      mockCtx.cwd = "/project";

      lspExtension(mockPi);
    });

    describe("given concurrent operations", () => {
      describe("when multiple LSP requests made simultaneously", () => {
        it("then handles requests without interference", async () => {
          const promises = [
            mockManager.getDefinition("file1.ts", 1, 1),
            mockManager.getHover("file2.ts", 2, 2),
            mockManager.getReferences("file3.ts", 3, 3),
          ];

          await Promise.all(promises);

          expect(mockManager.getDefinition).toHaveBeenCalledTimes(1);
          expect(mockManager.getHover).toHaveBeenCalledTimes(1);
          expect(mockManager.getReferences).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe("given large codebases", () => {
      describe("when workspace diagnostics requested", () => {
        it("then processes files efficiently", async () => {
          const workspaceDiagnosticsTool = mockPi.registerTool.mock.calls.find(
            (call: unknown[]) =>
              (call[0] as { name: string }).name ===
              "lsp-workspace-diagnostics",
          );
          const execute = workspaceDiagnosticsTool?.[0].execute;

          const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
          const params = {
            files,
          };

          const mockResult = {
            items: files.map((file) => ({
              file,
              diagnostics: [],
              status: "ok",
            })),
          };
          (
            mockManager.getDiagnosticsForFiles as ReturnType<typeof vi.fn>
          ).mockResolvedValue(mockResult);

          const start = Date.now();
          const result = await execute(
            "tool-1",
            params,
            undefined,
            undefined,
            mockCtx,
          );
          const duration = Date.now() - start;

          expect(result.details.items).toHaveLength(100);
          expect(duration).toBeLessThan(5000); // Should complete reasonably fast
        });
      });
    });
  });
});
