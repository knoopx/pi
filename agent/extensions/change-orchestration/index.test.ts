import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createMockExtensionAPI } from "../../shared/testing/test-factories";
import type { MockExtensionAPI } from "../../shared/testing/test-factories";
import setupExtension, { resetState } from "./index";
import { createBeginEditTool } from "./tools/begin-edit";
import { createFinishEditTool } from "./tools/finish-edit";
import * as stateModule from "./lib/state";

vi.mock("../jj/changes", () => ({
  createNewChange: vi.fn().mockResolvedValue({
    success: true,
    created: false,
  }),
}));

type EventHandler = (...args: unknown[]) => Promise<unknown>;

// Shared helpers for begin-edit / finish-edit lifecycle tests.
async function doBeginEdit(
  tool: ReturnType<typeof createBeginEditTool>,
  turnId: string,
  name: string,
  _mockPi: MockExtensionAPI,
) {
  await tool.execute(
    turnId,
    { name },
    undefined,
    undefined,
    {} as ExtensionContext,
  );
}

async function doFinishEdit(
  tool: ReturnType<typeof createFinishEditTool>,
  turnId: string,
  _mockPi: MockExtensionAPI,
) {
  await tool.execute(turnId, {}, undefined, undefined, {} as ExtensionContext);
}

function getHandlerByName(
  mockPi: MockExtensionAPI,
  eventName: string,
): EventHandler | undefined {
  const calls = mockPi.on.mock.calls as [string, EventHandler][];
  return calls.find(([name]) => name === eventName)?.[1];
}

// Assert that endHandler sends a finish-edit reminder.
async function assertFinishReminder(
  endHandler: EventHandler,
  mockPi: MockExtensionAPI,
  messageText: string,
) {
  await endHandler(
    {
      messages: [
        { role: "assistant", content: [{ type: "text", text: messageText }] },
      ],
    },
    { ui: { notify: vi.fn() } } as unknown as ExtensionContext,
  );
  expect(mockPi.sendMessage).toHaveBeenLastCalledWith(
    expect.objectContaining({
      customType: "edit-orchestration",
      content: expect.stringContaining("finish-edit()"),
    }),
  );
}

// Assert that endHandler does NOT send a finish-edit reminder.
async function assertNoFinishReminder(
  endHandler: EventHandler,
  mockPi: MockExtensionAPI,
  messageText: string,
) {
  const prevCount = mockPi.sendMessage.mock.calls.length;
  await endHandler(
    {
      messages: [
        { role: "assistant", content: [{ type: "text", text: messageText }] },
      ],
    },
    { ui: { notify: vi.fn() } } as unknown as ExtensionContext,
  );
  expect(mockPi.sendMessage.mock.calls.length).toBe(prevCount);
}

// Begin an edit and assert the name is set.
async function beginEditWithName(
  tool: ReturnType<typeof createBeginEditTool>,
  turnId: string,
  name: string,
  mockPi: MockExtensionAPI,
) {
  await doBeginEdit(tool, turnId, name, mockPi);
  expect(stateModule.getCurrentEdit()?.name).toBe(name);
}

describe("edit-orchestration extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    resetState();
  });

  it("registers two edit tools", () => {
    setupExtension(
      mockPi as unknown as import("@earendil-works/pi-coding-agent").ExtensionAPI,
    );
    expect(mockPi.registerTool).toHaveBeenCalledTimes(2);
  });

  it("registers agent_end handler", () => {
    setupExtension(
      mockPi as unknown as import("@earendil-works/pi-coding-agent").ExtensionAPI,
    );
    expect(mockPi.on).toHaveBeenCalledWith("agent_end", expect.any(Function));
  });

  describe("agent_end handler", () => {
    let handler: EventHandler;

    beforeEach(() => {
      mockPi = createMockExtensionAPI();
      resetState();
      setupExtension(
        mockPi as unknown as import("@earendil-works/pi-coding-agent").ExtensionAPI,
      );
      handler = getHandlerByName(mockPi, "agent_end")!;
    });

    it("sends message to finish current edit when active", async () => {
      stateModule.beginEdit("fix(auth): handle null pointer");

      const mockNotify = vi.fn();
      const ctx = { ui: { notify: mockNotify } } as unknown as ExtensionContext;

      await handler(
        {
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Working on it." }],
            },
          ],
        },
        ctx,
      );

      expect(mockPi.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          customType: "edit-orchestration",
          content: expect.stringContaining("finish-edit()"),
        }),
      );
    });

    it("sends no message when no current edit", async () => {
      const mockNotify = vi.fn();
      const ctx = { ui: { notify: mockNotify } } as unknown as ExtensionContext;

      await handler(
        {
          messages: [
            {
              role: "assistant",
              content: [{ type: "text", text: "Done working." }],
            },
          ],
        },
        ctx,
      );

      expect(mockPi.sendMessage).not.toHaveBeenCalled();
    });

    it("skips aborted turns", async () => {
      const mockNotify = vi.fn();
      const ctx = { ui: { notify: mockNotify } } as unknown as ExtensionContext;

      await handler(
        {
          messages: [
            { role: "user", content: "Do something" },
            { role: "assistant", stopReason: "aborted" },
          ],
        },
        ctx,
      );

      expect(mockNotify).not.toHaveBeenCalled();
    });
  });

  describe("begin-edit tool", () => {
    it("creates a tool with correct definition", () => {
      const tool = createBeginEditTool(mockPi as never);
      expect(tool.name).toBe("begin-edit");
      expect(tool.label).toBe("Begin Edit");
    });

    it("starts an edit and sets current", async () => {
      const tool = createBeginEditTool(mockPi as never);
      resetState();

      await tool.execute(
        "test-1",
        { name: "fix(auth): handle null pointer" },
        undefined,
        undefined,
        {} as ExtensionContext,
      );

      expect(stateModule.getCurrentEdit()?.name).toBe(
        "fix(auth): handle null pointer",
      );
    });

    it("returns started name in response", async () => {
      const tool = createBeginEditTool(mockPi as never);
      resetState();

      const result = (await tool.execute(
        "test-1",
        { name: "feat(api): add pagination" },
        undefined,
        undefined,
        {} as ExtensionContext,
      )) as {
        content: { type: string; text: string }[];
        details: { started: string };
      };

      expect(result.details.started).toBe("feat(api): add pagination");
      expect(result.content[0].text).toContain("feat(api): add pagination");
    });
  });

  describe("finish-edit tool", () => {
    it("creates a tool with correct definition", () => {
      const tool = createFinishEditTool(mockPi as never);
      expect(tool.name).toBe("finish-edit");
      expect(tool.label).toBe("Finish Edit");
    });

    it("finishes the current edit", async () => {
      const tool = createFinishEditTool(mockPi as never);
      resetState();
      stateModule.beginEdit("fix(auth): handle null pointer");

      const result = (await tool.execute(
        "test-1",
        {},
        undefined,
        undefined,
        {} as ExtensionContext,
      )) as { details: { finished: string | null } };

      expect(result.details.finished).toBe("fix(auth): handle null pointer");
      expect(stateModule.getCurrentEdit()).toBeNull();
    });

    it("reports error when no current edit", async () => {
      const tool = createFinishEditTool(mockPi as never);
      resetState();

      const result = (await tool.execute(
        "test-1",
        {},
        undefined,
        undefined,
        {} as ExtensionContext,
      )) as { content: { type: string; text: string }[] };

      expect(result.content[0].text).toContain("No current edit");
    });
  });

  describe("state module", () => {
    beforeEach(() => {
      resetState();
    });

    it("beginEdit sets current edit", () => {
      stateModule.beginEdit("fix(auth): handle null pointer");
      expect(stateModule.getCurrentEdit()?.name).toBe(
        "fix(auth): handle null pointer",
      );
    });

    it("finishEdit clears current edit", () => {
      stateModule.beginEdit("fix(auth): handle null pointer");
      const finished = stateModule.finishEdit();
      expect(finished?.name).toBe("fix(auth): handle null pointer");
      expect(stateModule.getCurrentEdit()).toBeNull();
    });

    it("resetState clears current edit", () => {
      stateModule.beginEdit("fix(auth): handle null pointer");
      resetState();
      expect(stateModule.getCurrentEdit()).toBeNull();
    });

    it("beginEdit overwrites previous current", () => {
      stateModule.beginEdit("first edit");
      stateModule.beginEdit("second edit");
      expect(stateModule.getCurrentEdit()?.name).toBe("second edit");
    });
  });

  describe("full lifecycle integration", () => {
    let mockPi: MockExtensionAPI;
    let endHandler: EventHandler;

    beforeEach(() => {
      mockPi = createMockExtensionAPI();
      resetState();
      setupExtension(
        mockPi as unknown as import("@earendil-works/pi-coding-agent").ExtensionAPI,
      );
      endHandler = getHandlerByName(mockPi, "agent_end")!;
    });

    it("successful session — begin, edit, finish cycle", async () => {
      const beginTool = createBeginEditTool(mockPi as never);
      const finishTool = createFinishEditTool(mockPi as never);

      await beginEditWithName(
        beginTool,
        "t1",
        "fix(auth): handle null pointer",
        mockPi,
      );
      await doFinishEdit(finishTool, "t2", mockPi);
      expect(stateModule.getCurrentEdit()).toBeNull();

      await beginEditWithName(
        beginTool,
        "t3",
        "feat(api): add pagination",
        mockPi,
      );
      await doFinishEdit(finishTool, "t4", mockPi);
      expect(stateModule.getCurrentEdit()).toBeNull();
    });

    it("agent_end triggers finish reminder", async () => {
      const beginTool = createBeginEditTool(mockPi as never);

      await doBeginEdit(
        beginTool,
        "t1",
        "fix(auth): handle null pointer",
        mockPi,
      );

      await assertFinishReminder(endHandler, mockPi, "Done.");
    });

    it("multiple edits per session", async () => {
      const beginTool = createBeginEditTool(mockPi as never);
      const finishTool = createFinishEditTool(mockPi as never);

      // --- Turn 1: Edit A ---

      await beginEditWithName(
        beginTool,
        "t1",
        "fix(auth): handle null pointer",
        mockPi,
      );

      await assertFinishReminder(endHandler, mockPi, "Fixed.");

      await doFinishEdit(finishTool, "t3", mockPi);
      expect(stateModule.getCurrentEdit()).toBeNull();

      // --- Turn 2: Edit B ---

      await beginEditWithName(
        beginTool,
        "t4",
        "feat(api): add pagination",
        mockPi,
      );

      await assertFinishReminder(endHandler, mockPi, "Pagination done.");

      await doFinishEdit(finishTool, "t5", mockPi);
      expect(stateModule.getCurrentEdit()).toBeNull();

      // agent_end: no active edit → no message
      await assertNoFinishReminder(endHandler, mockPi, "All done.");
    });
  });
});
