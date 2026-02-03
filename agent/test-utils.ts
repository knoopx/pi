/**
 * Shared types for testing pi extensions
 */

import { vi } from "vitest";
import type { AgentToolResult } from "@mariozechner/pi-coding-agent";

/**
 * Mock tool interface for testing extension tool registration
 * Execute signature: (toolCallId, params, signal, onUpdate, ctx)
 */
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

/**
 * Mock command interface for testing extension command registration
 */
export interface MockCommand {
	name: string;
	description?: string;
	handler: (args: string[], ctx?: unknown) => Promise<void>;
}

/**
 * Mock ExtensionAPI interface for testing.
 * Extends the real ExtensionAPI with all methods as vi.fn() spies.
 */
export interface MockExtensionAPI {
	on: ReturnType<typeof vi.fn>;
	registerTool: ReturnType<typeof vi.fn>;
	registerCommand?: ReturnType<typeof vi.fn>;
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
	getCommands: ReturnType<typeof vi.fn>;
	events: unknown;
	[key: string]: unknown;
}

/**
 * Create a standard error result for testing
 */
export function createTestErrorResult(
	message: string,
): AgentToolResult<Record<string, unknown>> {
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
		getCommands: vi.fn(),
		events: {},
	};
}
