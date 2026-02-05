import { beforeEach, describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ImageContent, TextContent } from "@mariozechner/pi-ai";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import setupNomnomlExtension from "./index";
import type { MockExtensionAPI, MockTool } from "../../test-utils";
import { createMockExtensionAPI } from "../../test-utils";

describe("Nomnoml Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupNomnomlExtension(mockPi as ExtensionAPI);
  });

  it("registers the render_nomnoml tool", () => {
    expect(mockPi.registerTool).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "render_nomnoml",
        label: "Render nomnoml",
      }),
    );
  });

  describe("render_nomnoml tool", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls[0][0];
    });

    it("attaches an SVG image when the model supports images", async () => {
      const result = await tool.execute(
        "tool1",
        {
          source: "#direction: right\n[A]->[B]",
        },
        undefined,
        undefined,
        {
          model: { input: ["text", "image"] },
        },
      );

      const summary = result.content[0] as TextContent;
      expect(summary.type).toBe("text");
      expect(summary.text).toContain("Rendered nomnoml diagram");

      const image = result.content[1] as ImageContent;
      expect(image.type).toBe("image");
      expect(image.mimeType).toBe("image/svg+xml");
      expect(image.data.length).toBeGreaterThan(0);

      expect(result.details).toEqual({
        rendered: true,
        format: "svg",
        outputFile: null,
        attached: true,
      });
    });

    it("writes the SVG to outputFile when provided", async () => {
      const out = join(tmpdir(), `pi-nomnoml-${Date.now()}.svg`);

      const result = await tool.execute(
        "tool1",
        {
          source: "[A]->[B]",
          outputFile: out,
        },
        undefined,
        undefined,
        { model: { input: ["text", "image"] } },
      );

      expect(result.details).toEqual({
        rendered: true,
        format: "svg",
        outputFile: out,
        attached: true,
      });

      const written = await readFile(out, "utf8");
      expect(written).toContain("<svg");
    });
  });
});
