import { expect, it, vi } from "vitest";
import type {
  AgentToolResult,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";

// Mock gh-cmd for tests that need it
export const mockGhCmd = vi.fn();
export const mockGhCmdJson = vi.fn();
const mockGhCmdJsonWithInput = vi.fn();

vi.mock("../process/gh-cmd", () => ({
  ghCmd: (...args: unknown[]) => mockGhCmd(...args),
  ghCmdJson: (...args: unknown[]) => mockGhCmdJson(...args),
  ghCmdJsonWithInput: mockGhCmdJsonWithInput,
}));

export interface MockTool {
  name: string;
  label?: string;
  description?: string;
  execute: (
    toolCallId: string,
    params: unknown,
    signal: AbortSignal | undefined,
    onUpdate:
      | ((update: AgentToolResult<Record<string, unknown>>) => void)
      | undefined,
    ctx: unknown,
  ) => Promise<AgentToolResult<Record<string, unknown>>>;
}
export interface MockExtensionAPI {
  on: ReturnType<typeof vi.fn>;
  registerTool: ReturnType<typeof vi.fn>;
  registerCommand: ReturnType<typeof vi.fn>;
  registerShortcut: ReturnType<typeof vi.fn>;
  registerFlag: ReturnType<typeof vi.fn>;
  getFlag: ReturnType<typeof vi.fn>;
  registerMessageRenderer: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  sendUserMessage: ReturnType<typeof vi.fn>;
  appendEntry: ReturnType<typeof vi.fn>;
  setSessionName: ReturnType<typeof vi.fn>;
  getSessionName: ReturnType<typeof vi.fn>;
  setLabel: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
  getActiveTools: ReturnType<typeof vi.fn>;
  getAllTools: ReturnType<typeof vi.fn>;
  setActiveTools: ReturnType<typeof vi.fn>;
  setModel: ReturnType<typeof vi.fn>;
  getThinkingLevel: ReturnType<typeof vi.fn>;
  setThinkingLevel: ReturnType<typeof vi.fn>;
  registerProvider: ReturnType<typeof vi.fn>;
  unregisterProvider: ReturnType<typeof vi.fn>;
  getCommands: ReturnType<typeof vi.fn>;
  events: unknown;
  [key: string]: unknown;
}
export function createMockPi(
  overrides?: Partial<MockExtensionAPI>,
): ExtensionAPI {
  return {
    ...createMockExtensionAPI(),
    getFlag: vi.fn().mockReturnValue(null),
    exec: vi.fn().mockResolvedValue({
      code: 0,
      stdout: "",
      stderr: "",
    }),
    ...overrides,
  } as unknown as ExtensionAPI;
}

export function createMockExtensionAPI(): MockExtensionAPI {
  return {
    on: vi.fn(),
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
    registerFlag: vi.fn(),
    getFlag: vi.fn(),
    registerMessageRenderer: vi.fn(),
    sendMessage: vi.fn(),
    sendUserMessage: vi.fn(),
    appendEntry: vi.fn(),
    setSessionName: vi.fn(),
    getSessionName: vi.fn(),
    setLabel: vi.fn(),
    exec: vi.fn(),
    getActiveTools: vi.fn(),
    getAllTools: vi.fn(),
    setActiveTools: vi.fn(),
    setModel: vi.fn(),
    getThinkingLevel: vi.fn(),
    setThinkingLevel: vi.fn(),
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    getCommands: vi.fn(),
    events: {} as ExtensionAPI["events"],
  };
}

export function createMockGist(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "abc123",
    description: "Test gist",
    public: true,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-16T12:00:00Z",
    html_url: "https://gist.github.com/abc123",
    files: {
      "main.ts": {
        filename: "main.ts",
        type: "text",
        language: "TypeScript",
        content: "console.log('hi');",
        raw_url: "https://gist.githubusercontent.com/abc123/raw/main.ts",
        size: 512,
      },
    },
    user: { login: "octocat", id: 1, avatar_url: "", html_url: "" },
    ...overrides,
  };
}

export function createMockIssue(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    number: 42,
    title: "Fix bug",
    state: "OPEN",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-16T12:00:00Z",
    author: { login: "octocat", avatar_url: "", html_url: "" },
    body: "Bug description",
    html_url: "https://github.com/owner/repo/issues/42",
    labels: [{ name: "bug", description: "", color: "red" }],
    milestone: { title: "v1.0", description: "", dueOn: "" },
    comments: [],
    ...overrides,
  };
}

export function createMockPR(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    number: 100,
    title: "Add feature",
    state: "OPEN",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-16T12:00:00Z",
    baseRefName: "main",
    headRefName: "feature-branch",
    author: { login: "octocat", avatar_url: "", html_url: "" },
    body: "Feature description",
    html_url: "https://github.com/owner/repo/pull/100",
    mergeable: "true",
    reviewDecision: "APPROVED",
    reviews: [],
    ...overrides,
  };
}

export function createMockFile(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: "README.md",
    path: "README.md",
    sha: "abc123",
    size: 1024,
    url: "https://api.github.com/repos/o/r/contents/README.md",
    html_url: "https://github.com/o/r/blob/main/README.md",
    git_url: "https://api.github.com/repos/o/r/git/blobs/abc123",
    download_url: "https://raw.githubusercontent.com/o/r/main/README.md",
    type: "file",
    ...overrides,
  };
}

export function createToolCall(overrides: Record<string, unknown> = {}): {
  name: string;
  input: unknown;
} {
  return { name: "read", input: { path: "/a" }, ...overrides };
}

export function expectNoToolFollowUp(
  mockPi: MockExtensionAPI,
  mockCtx: { ui: { notify: (...args: never[]) => void } },
): void {
  expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  const notifyMock = mockCtx.ui.notify as ReturnType<typeof vi.fn>;
  expect(notifyMock).not.toHaveBeenCalled();
}

export function expectEarlyReturnOnNullMessage(
  handler: (event: Record<string, unknown>, ctx: ExtensionContext) => unknown,
  mockPi: MockExtensionAPI,
  mockCtx: ExtensionContext,
): void {
  it("returns early when message is null", async () => {
    await handler({ message: null }, mockCtx);
    expect(mockPi.sendUserMessage).not.toHaveBeenCalled();
  });
}

export function registerAndAssert(
  mockPi: MockExtensionAPI,
  registerFn: (pi: ExtensionAPI) => void,
): void {
  registerFn(mockPi as ExtensionAPI);
}

export function assertHasAllTools(
  mockPi: MockExtensionAPI,
  toolNames: string[],
): void {
  const registered = mockPi.registerTool.mock.calls.map(
    (call: unknown[]) => (call[0] as { name: string }).name,
  );
  for (const name of toolNames) {
    expect(registered).toContain(name);
  }
}

export function assertToolDescriptions(mockPi: MockExtensionAPI): void {
  const calls = mockPi.registerTool.mock.calls as unknown[];
  for (const call of calls) {
    const def = (call as unknown[])[0] as { description?: string };
    expect(def.description).toBeDefined();
    expect(typeof def.description).toBe("string");
  }
}

export function assertToolParameters(mockPi: MockExtensionAPI): void {
  const calls = mockPi.registerTool.mock.calls as unknown[];
  for (const call of calls) {
    const def = (call as unknown[])[0] as { parameters?: unknown };
    expect(def.parameters).toBeDefined();
  }
}

export function createMockContext(
  overrides: Partial<ExtensionContext> = {},
): ExtensionContext {
  return {
    cwd: "/tmp/test",
    sessionId: "test-session",
    model: null,
    hasUI: true,
    isIdle: () => true,
    hasPendingMessages: () => false,
    abort: vi.fn(),
    ui: {
      notify: vi.fn(),
    },
    ...overrides,
  } as unknown as ExtensionContext;
}

export function createMockCommandContext(
  overrides: Partial<ExtensionCommandContext> = {},
): ExtensionCommandContext {
  return {
    cwd: "/tmp/test",
    hasUI: true,
    abort: vi.fn(),
    ...overrides,
  } as unknown as ExtensionCommandContext;
}

export type EventHandlerMap = Record<string, (...args: unknown[]) => void>;

export function extractEventHandlers(
  mockPi: MockExtensionAPI,
): EventHandlerMap {
  const calls = mockPi.on.mock.calls as [
    string,
    (...args: unknown[]) => void,
  ][];
  const handlers: EventHandlerMap = {};
  for (const [eventName, handler] of calls) {
    handlers[eventName] = handler;
  }
  return handlers;
}

export function createMockExtensionContext(
  overrides: Partial<ExtensionContext> = {},
): ExtensionContext {
  return {
    cwd: "/test",
    hasUI: true,
    ui: {
      notify: vi.fn(),
      theme: {} as ExtensionUIContext["theme"],
    } as unknown as ExtensionUIContext,
    ...overrides,
  } as ExtensionContext;
}

export function createExtensionFixture(setupFn: (api: ExtensionAPI) => void) {
  let _mockPi: MockExtensionAPI = createMockExtensionAPI();
  let _mockCtx: ExtensionContext = createMockExtensionContext();
  const _handlers: Partial<Record<string, (...args: unknown[]) => unknown>> =
    {};

  return {
    get mockPi(): MockExtensionAPI {
      return _mockPi;
    },
    get mockCtx(): ExtensionContext {
      return _mockCtx;
    },
    getHandler<T extends (...args: unknown[]) => unknown>(name: string): T {
      return _handlers[name] as T;
    },
    setup() {
      _mockPi = createMockExtensionAPI();
      setupFn(_mockPi as ExtensionAPI);
      Object.assign(_handlers, extractEventHandlers(_mockPi));
      _mockCtx = createMockExtensionContext();
    },
  };
}

export function assertRenderMethods(mockPi: MockExtensionAPI): void {
  const calls = mockPi.registerTool.mock.calls as unknown[];
  for (const call of calls) {
    const def = (call as unknown[])[0] as {
      renderCall?: unknown;
      renderResult?: unknown;
    };
    expect(def.renderCall || def.renderResult).toBeDefined();
  }
}
