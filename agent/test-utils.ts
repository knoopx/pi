/**
 * Shared types for testing pi extensions
 */

import { vi } from "vitest";
import type { AgentToolResult } from "@mariozechner/pi-coding-agent";

/**
 * Mock tool interface for testing extension tool registration
 */
export interface MockTool {
  name: string;
  label?: string;
  description?: string;
  execute: (
    id: string,
    params: unknown,
    onUpdate?: (update: AgentToolResult<Record<string, unknown>>) => void,
    ctx?: unknown,
    signal?: AbortSignal,
  ) => Promise<AgentToolResult<Record<string, unknown>>>;
}

/**
 * Mock command interface for testing extension command registration
 */
export interface MockCommand {
  name: string;
  description?: string;
  handler: (args: string[], ctx?: unknown) => Promise<void>;
}

/**
 * Mock ExtensionAPI interface for testing
 */
export interface MockExtensionAPI {
  registerTool: (tool: MockTool) => void;
  registerCommand?: (name: string, options: Omit<MockCommand, "name">) => void;
  exec?: (
    command: string,
    args?: string[],
    options?: { signal?: AbortSignal }
  ) => Promise<{ code: number; stdout: string; stderr: string }>;
  [key: string]: unknown;
}

/**
 * Create a standard error result for testing
 */
export function createTestErrorResult(message: string): AgentToolResult<Record<string, unknown>> {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${message}`,
      },
    ],
    details: { error: message },
  };
}

/**
 * Create a basic mock ExtensionAPI for testing
 */
export function createMockExtensionAPI(): MockExtensionAPI {
  return {
    registerTool: vi.fn(),
    registerCommand: vi.fn(),
    exec: vi.fn(),
  };
}