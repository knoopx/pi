import { beforeEach, describe, expect, it } from "vitest";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ImageContent } from "@mariozechner/pi-ai";

import setupNomnomlExtension from "./index";
import type { MockExtensionAPI, MockTool } from "../../shared/test-utils";
import { createMockExtensionAPI } from "../../shared/test-utils";

describe("Nomnoml Extension", () => {
  let mockPi: MockExtensionAPI;

  beforeEach(() => {
    mockPi = createMockExtensionAPI();
    setupNomnomlExtension(mockPi as ExtensionAPI);
  });

  it("registers the nomnoml render tool", () => {
    const toolNames = mockPi.registerTool.mock.calls.map(
      (call) => call[0].name,
    );
    expect(toolNames).toContain("nomnoml-display");
  });

  describe("nomnoml-display tool", () => {
    let tool: MockTool;

    beforeEach(() => {
      tool = mockPi.registerTool.mock.calls.find(
        (call) => call[0].name === "nomnoml-display",
      )?.[0] as MockTool;
    });

    it("attaches a PNG image when the model supports images", async () => {
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

      const image = result.content[0] as ImageContent;
      expect(image.type).toBe("image");
      expect(image.mimeType).toBe("image/png");
      expect(image.data.length).toBeGreaterThan(0);

      expect(result.details).toEqual({
        rendered: true,
        format: "png",
        outputFile: null,
        attached: true,
      });
    });
  });
});
