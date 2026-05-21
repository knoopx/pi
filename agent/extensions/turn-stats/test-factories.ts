import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { vi } from "vitest";
import {
  createMockExtensionAPI,
  extractEventHandlers,
} from "../../shared/testing/test-factories";
import type {
  EventHandlerMap,
  MockExtensionAPI,
} from "../../shared/testing/test-factories";

export interface EventHandlerCalls {
  turnStart: (...args: unknown[]) => void;
  messageStart: (...args: unknown[]) => void;
  messageUpdate: (...args: unknown[]) => void;
  messageEnd: (...args: unknown[]) => void;
  turnEnd: (...args: unknown[]) => void;
  agentStart: (...args: unknown[]) => void;
  agentEnd: (...args: unknown[]) => void;
  sessionStart: (...args: unknown[]) => void;
  sessionShutdown: (...args: unknown[]) => void;
}

const EVENT_MAP: [keyof EventHandlerCalls, string][] = [
  ["turnStart", "turn_start"],
  ["messageStart", "message_start"],
  ["messageUpdate", "message_update"],
  ["messageEnd", "message_end"],
  ["turnEnd", "turn_end"],
  ["agentStart", "agent_start"],
  ["agentEnd", "agent_end"],
  ["sessionStart", "session_start"],
  ["sessionShutdown", "session_shutdown"],
];

function getHandlers(handlers: EventHandlerMap): EventHandlerCalls {
  const result = {} as EventHandlerCalls;
  for (const [key, event] of EVENT_MAP) {
    result[key] = handlers[event] ?? (() => {});
  }
  return result;
}

export async function setupTurnStats(): Promise<{
  mockPi: MockExtensionAPI;
  handlers: EventHandlerCalls;
}> {
  vi.resetModules();
  const mockPi = createMockExtensionAPI();
  const mod = await import("./index");
  (mod.default as (pi: ExtensionAPI) => void)(mockPi as ExtensionAPI);
  return { mockPi, handlers: getHandlers(extractEventHandlers(mockPi)) };
}

function setupMessageFlow(
  handlers: EventHandlerCalls,
  timestamp?: number,
): void {
  handlers.turnStart({ timestamp: timestamp ?? Date.now() });
  handlers.messageStart({
    message: { role: "assistant" } as unknown,
    timestamp: timestamp ?? Date.now(),
  });
}

export function completeMessageFlow(
  handlers: EventHandlerCalls,
  timestamp?: number,
): void {
  setupMessageFlow(handlers, timestamp);
  handlers.messageEnd({
    message: { role: "assistant" } as unknown,
    timestamp: timestamp ?? Date.now(),
  });
}

export function setupMessageUpdateFlow(
  handlers: EventHandlerCalls,
  timestamp?: number,
): void {
  setupMessageFlow(handlers, timestamp);
  handlers.messageUpdate({
    message: { role: "assistant" } as unknown,
    timestamp: timestamp ?? Date.now(),
  });
}
