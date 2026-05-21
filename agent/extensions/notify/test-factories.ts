import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { vi } from "vitest";
import {
  createMockCommandContext,
  createMockExtensionAPI,
} from "../../shared/testing/test-factories";
import type { MockTool } from "../../shared/testing/test-factories";

export function createMockFsPromises() {
  return {
    readFile: vi.fn().mockResolvedValue("{}"),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  };
}

export async function setupNotifyTool() {
  const mockPi = createMockExtensionAPI();
  vi.resetModules();
  const { default: ext } = await import("./index");
  await ext(mockPi as ExtensionAPI);
  const calls = mockPi.registerTool.mock.calls as [MockTool][];
  const tool = calls.find((c) => c[0]?.name === "notify")![0];
  return { mockPi, tool };
}

type NotifyToolSetup = Awaited<ReturnType<typeof setupNotifyTool>>;

export function createNotifyFixture() {
  let _mockPi: NotifyToolSetup["mockPi"] = {} as NotifyToolSetup["mockPi"];
  let _tool: NotifyToolSetup["tool"] = {} as NotifyToolSetup["tool"];

  return {
    get mockPi(): NotifyToolSetup["mockPi"] {
      return _mockPi;
    },
    get tool(): NotifyToolSetup["tool"] {
      return _tool;
    },
    async setup() {
      const result = await setupNotifyTool();
      _mockPi = result.mockPi;
      _tool = result.tool;
    },
  };
}

export async function sendNotification(
  tool: Awaited<ReturnType<typeof setupNotifyTool>>["tool"],
  hasUI: boolean,
): Promise<unknown> {
  return tool.execute(
    "id",
    { message: "hello" },
    undefined,
    undefined,
    createMockCommandContext({ hasUI }),
  );
}
