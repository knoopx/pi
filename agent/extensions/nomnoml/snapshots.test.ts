/**
 * Snapshot tests for Nomnoml tool output.
 */

import { describe, expect, it, beforeEach } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import { createMockExtensionAPI } from "../../shared/test-utils";
import type { MockExtensionAPI, MockTool } from "../../shared/test-utils";

describe("nomnoml output snapshots", () => {
  let mockPi: MockExtensionAPI;
  let displayTool: MockTool;
  let renderTool: MockTool;

  beforeEach(async () => {
    mockPi = createMockExtensionAPI();
    const { default: ext } = await import("./index");
    ext(mockPi as ExtensionAPI);

    displayTool = mockPi.registerTool.mock.calls.find(
      (c) => c[0].name === "nomnoml-display",
    )![0] as MockTool;
    renderTool = mockPi.registerTool.mock.calls.find(
      (c) => c[0].name === "nomnoml-render",
    )![0] as MockTool;
  });

  it("renders display tool details on success", async () => {
    const result = await displayTool.execute(
      "id",
      { source: "[A]->[B]" },
      undefined,
      undefined,
      { model: { input: ["text", "image"] } },
    );
    expect(result.details).toEqual({
      rendered: true,
      attached: true,
      format: "png",
      outputFile: null,
    });
    expect((result.content[0] as ImageContent).type).toBe("image");
    expect((result.content[0] as ImageContent).mimeType).toBe("image/png");
  });

  it("renders render tool details on success", async () => {
    const result = await renderTool.execute(
      "id",
      { source: "[C]->[D]" },
      undefined,
      undefined,
      { model: { input: ["text", "image"] } },
    );
    expect(result.details).toEqual({
      rendered: true,
      attached: true,
      format: "png",
      outputFile: null,
    });
  });

  it("renders error for missing source and inputFile", async () => {
    const result = await displayTool.execute("id", {}, undefined, undefined, {
      model: { input: ["text", "image"] },
    });
    expect((result.content[0] as TextContent).text).toBe(
      "Provide exactly one of: source or inputFile.",
    );
  });
});
