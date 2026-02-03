// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import setupMarkitdownExtension from "./index";
import type { MockTool, MockExtensionAPI } from "../../test-utils";
import { createMockExtensionAPI } from "../../test-utils";

// ============================================
// Extension Registration
// ============================================
describe("Markitdown Extension", () => {
	let mockPi: MockExtensionAPI;

	beforeEach(() => {
		mockPi = createMockExtensionAPI();
		setupMarkitdownExtension(mockPi as ExtensionAPI);
	});

	describe("given the extension is initialized", () => {
		describe("when registering tools", () => {
			it("then it should register transcribe tool", () => {
				expect(mockPi.registerTool).toHaveBeenCalledWith(
					expect.objectContaining({
						name: "transcribe",
						label: "Transcribe",
					}),
				);
			});

			it("then it should register with the correct label", () => {
				const call = mockPi.registerTool.mock.calls[0];
				expect(call[0].label).toBe("Transcribe");
			});
		});
	});

	// ============================================
	// Transcribe Tool
	// ============================================
	describe("transcribe tool", () => {
		let registeredTool: MockTool;

		beforeEach(() => {
			registeredTool = mockPi.registerTool.mock.calls[0][0];
		});

		// Execute signature: (toolCallId, params, signal, onUpdate, ctx)
		describe("given a local file to convert", () => {
			let result: AgentToolResult<Record<string, unknown>>;
			let onUpdate: (update: AgentToolResult<Record<string, unknown>>) => void;

			beforeEach(async () => {
				const mockResult = {
					code: 0,
					stdout:
						"# Converted Markdown Content\n\nThis is the converted content.",
					stderr: "",
				};
				mockPi.exec.mockResolvedValue(mockResult);

				onUpdate = vi.fn().mockReturnValue(undefined);

				result = await registeredTool.execute(
					"tool1",
					{ source: "/path/to/file.pdf" },
					undefined, // signal
					onUpdate,
					{}, // ctx
				);
			});

			it("then it should execute markitdown with the file path", () => {
				expect(mockPi.exec).toHaveBeenCalledWith(
					"markitdown",
					["/path/to/file.pdf"],
					undefined,
				);
			});

			it("then it should notify the user that conversion started", () => {
				expect(onUpdate).toHaveBeenCalledWith({
					content: [
						{
							type: "text",
							text: "Converting /path/to/file.pdf to Markdown...",
						},
					],
					details: {
						source: "/path/to/file.pdf",
						status: "converting",
					},
				});
			});

			it("then it should return the converted content", () => {
				expect((result.content[0] as TextContent).text).toBe(
					"# Converted Markdown Content\n\nThis is the converted content.",
				);
			});

			it("then it should mark the conversion as successful", () => {
				expect(result.details).toEqual({
					source: "/path/to/file.pdf",
					converted: true,
				});
			});
		});

		describe("given a URL to convert", () => {
			let result: AgentToolResult<Record<string, unknown>>;

			beforeEach(async () => {
				const mockResult = {
					code: 0,
					stdout: "# Webpage Title\n\nContent from the webpage.",
					stderr: "",
				};
				mockPi.exec.mockResolvedValue(mockResult);

				result = await registeredTool.execute(
					"tool1",
					{ source: "https://example.com/page" },
					undefined, // signal
					vi.fn(), // onUpdate
					{}, // ctx
				);
			});

			it("then it should execute markitdown with the URL", () => {
				expect(mockPi.exec).toHaveBeenCalledWith(
					"markitdown",
					["https://example.com/page"],
					undefined,
				);
			});

			it("then it should return the webpage content", () => {
				expect((result.content[0] as TextContent).text).toBe(
					"# Webpage Title\n\nContent from the webpage.",
				);
			});

			it("then it should mark the conversion as successful", () => {
				expect(result.details).toEqual({
					source: "https://example.com/page",
					converted: true,
				});
			});
		});

		describe("given a local file that does not exist", () => {
			let result: AgentToolResult<Record<string, unknown>>;
			let onUpdate: (update: AgentToolResult<Record<string, unknown>>) => void;

			beforeEach(async () => {
				const mockResult = {
					code: 1,
					stdout: "",
					stderr: "markitdown: file not found",
				};
				mockPi.exec.mockResolvedValue(mockResult);

				onUpdate = vi.fn();

				result = await registeredTool.execute(
					"tool1",
					{ source: "/nonexistent/file.pdf" },
					undefined, // signal
					onUpdate,
					{}, // ctx
				);
			});

			it("then it should notify the user that conversion started", () => {
				expect(onUpdate).toHaveBeenCalledWith({
					content: [
						{
							type: "text",
							text: "Converting /nonexistent/file.pdf to Markdown...",
						},
					],
					details: {
						source: "/nonexistent/file.pdf",
						status: "converting",
					},
				});
			});

			it("then it should return error in content", () => {
				expect((result.content[0] as TextContent).text).toContain(
					"Error converting source: markitdown: file not found",
				);
			});

			it("then it should mark the conversion as failed", () => {
				expect(result.details).toEqual({
					source: "/nonexistent/file.pdf",
					error: "markitdown: file not found",
				});
			});
		});

		describe("given markitdown command is not available", () => {
			let result: AgentToolResult<Record<string, unknown>>;
			let onUpdate: (update: AgentToolResult<Record<string, unknown>>) => void;

			beforeEach(async () => {
				mockPi.exec.mockRejectedValue(new Error("Command not found"));

				onUpdate = vi.fn();

				result = await registeredTool.execute(
					"tool1",
					{ source: "/path/to/file.pdf" },
					undefined, // signal
					onUpdate,
					{}, // ctx
				);
			});

			it("then it should notify the user that conversion started", () => {
				expect(onUpdate).toHaveBeenCalledWith({
					content: [
						{
							type: "text",
							text: "Converting /path/to/file.pdf to Markdown...",
						},
					],
					details: {
						source: "/path/to/file.pdf",
						status: "converting",
					},
				});
			});

			it("then it should return unexpected error in content", () => {
				expect((result.content[0] as TextContent).text).toContain(
					"Unexpected error: Error: Command not found",
				);
			});

			it("then it should mark the conversion as failed", () => {
				expect(result.details).toEqual({
					source: "/path/to/file.pdf",
					error: "Error: Command not found",
				});
			});
		});

		describe("given an abort signal", () => {
			let signal: AbortSignal;

			beforeEach(async () => {
				const mockResult = {
					code: 0,
					stdout: "Converted content",
					stderr: "",
				};
				mockPi.exec.mockResolvedValue(mockResult);

				const abortController = new AbortController();
				signal = abortController.signal;

				await registeredTool.execute(
					"tool1",
					{ source: "/path/to/file.pdf" },
					signal, // signal
					vi.fn(), // onUpdate
					{}, // ctx
				);
			});

			it("then it should pass the signal to the exec function", () => {
				expect(mockPi.exec).toHaveBeenCalledWith(
					"markitdown",
					["/path/to/file.pdf"],
					{ signal },
				);
			});
		});
	});
});
