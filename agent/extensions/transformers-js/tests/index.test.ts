import { Buffer } from "node:buffer";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { pipelineMock, rawImageReadMock } = vi.hoisted(() => {
  return {
    pipelineMock: vi.fn(),
    rawImageReadMock: vi.fn(),
  };
});

vi.mock("@huggingface/transformers", () => {
  return {
    pipeline: pipelineMock,
    RawImage: {
      read: rawImageReadMock,
    },
  };
});

type ToolParams = Record<string, unknown>;

type ToolUpdate = {
  content?: { type: string; text: string }[];
  details?: Record<string, unknown>;
};

type ToolContent = {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
};

type ToolResult = {
  content: ToolContent[];
  details: Record<string, unknown>;
};

interface ToolConfig {
  name: string;
  execute: (
    toolCallId: string,
    params: ToolParams,
    signal: AbortSignal | undefined,
    onUpdate: ((update: ToolUpdate) => void) | undefined,
    ctx: unknown,
  ) => Promise<ToolResult>;
}

const loadExtension = async () => {
  const module = await import("../index");
  return module.default;
};

const setupExtension = async () => {
  const tools: ToolConfig[] = [];
  const mockPi: { registerTool: (config: ToolConfig) => void } = {
    registerTool: vi.fn((config: ToolConfig) => {
      tools.push(config);
    }),
  };

  const extension = await loadExtension();
  extension(mockPi as unknown as ExtensionAPI);

  return { tools, mockPi };
};

const getTool = (tools: ToolConfig[], name: string) => {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Tool not registered: ${name}`);
  }
  return tool;
};

const createDetectorMock = (
  results: Array<{
    score: number;
    label: string;
    box: { xmin: number; ymin: number; xmax: number; ymax: number };
  }>,
) => {
  return vi.fn().mockResolvedValue(results);
};

describe("transformers-js extension", () => {
  beforeEach(async () => {
    vi.resetModules();
    pipelineMock.mockReset();
    rawImageReadMock.mockReset();
    rawImageReadMock.mockResolvedValue("image-input");
  });

  describe("given the extension is loaded", () => {
    describe("when registering tools", () => {
      it("then registers all non-text tools", async () => {
        const { tools, mockPi } = await setupExtension();

        const toolNames = tools.map((tool) => tool.name);

        expect(mockPi.registerTool).toHaveBeenCalledTimes(15);
        expect(toolNames).toEqual([
          "ml-image-classification",
          "ml-image-feature-extraction",
          "ml-image-segmentation",
          "ml-background-removal",
          "ml-image-to-image",
          "ml-depth-estimation",
          "ml-image-to-text",
          "ml-document-question-answering",
          "ml-zero-shot-image-classification",
          "ml-object-detection",
          "ml-zero-shot-object-detection",
          "ml-audio-classification",
          "ml-zero-shot-audio-classification",
          "ml-automatic-speech-recognition",
          "ml-text-to-speech",
        ]);
      });
    });
  });

  describe("given the image classification tool", () => {
    describe("when classifying images", () => {
      it("then returns formatted labels", async () => {
        const classifier = vi
          .fn()
          .mockResolvedValue([{ label: "cat", score: 0.9 }]);
        pipelineMock.mockResolvedValue(classifier);

        const { tools } = await setupExtension();
        const tool = getTool(tools, "ml-image-classification");

        const result = await tool.execute(
          "call",
          { image: "image.png", topK: 2 },
          undefined,
          undefined,
          {},
        );

        expect(pipelineMock).toHaveBeenCalledWith(
          "image-classification",
          "Xenova/vit-base-patch16-224",
          { dtype: "q8" },
        );
        expect(rawImageReadMock).toHaveBeenCalledWith("image.png");
        expect(result.content[0].text).toContain("cat: 90.0%");
      });
    });
  });

  describe("given the audio classification tool", () => {
    describe("when classifying audio", () => {
      it("then returns formatted labels", async () => {
        const classifier = vi
          .fn()
          .mockResolvedValue([{ label: "speech", score: 0.7 }]);
        pipelineMock.mockResolvedValue(classifier);

        const { tools } = await setupExtension();
        const tool = getTool(tools, "ml-audio-classification");

        const result = await tool.execute(
          "call",
          { audio: "audio.wav" },
          undefined,
          undefined,
          {},
        );

        expect(result.content[0].text).toContain("speech: 70.0%");
      });
    });
  });

  describe("given the text-to-speech tool", () => {
    describe("when generating audio", () => {
      it("then returns base64 audio details", async () => {
        const wavData = Uint8Array.from([1, 2, 3]).buffer;
        const synthesizer = vi.fn().mockResolvedValue({
          toWav: vi.fn().mockReturnValue(wavData),
          sampling_rate: 16000,
          audio: new Float32Array([0.1, 0.2]),
        });
        pipelineMock.mockResolvedValue(synthesizer);

        const { tools } = await setupExtension();
        const tool = getTool(tools, "ml-text-to-speech");

        const result = await tool.execute(
          "call",
          { text: "Hello" },
          undefined,
          undefined,
          {},
        );

        const expectedBase64 = Buffer.from(wavData).toString("base64");
        expect(result.details.audioBase64).toBe(expectedBase64);
        expect(result.details.samplingRate).toBe(16000);
      });
    });
  });

  describe("given the object detection tool", () => {
    describe("when results meet the threshold", () => {
      it("then returns filtered detections", async () => {
        const detector = createDetectorMock([
          {
            score: 0.6,
            label: "cat",
            box: { xmin: 1, ymin: 2, xmax: 3, ymax: 4 },
          },
          {
            score: 0.2,
            label: "dog",
            box: { xmin: 5, ymin: 6, xmax: 7, ymax: 8 },
          },
        ]);
        pipelineMock.mockResolvedValue(detector);

        const { tools } = await setupExtension();
        const tool = getTool(tools, "ml-object-detection");

        const result = await tool.execute(
          "call",
          { image: "image.png", threshold: 0.5 },
          undefined,
          undefined,
          {},
        );

        expect(rawImageReadMock).toHaveBeenCalledWith("image.png");
        expect(result.content[0].text).toContain("cat 60.0%");
        expect(result.content[0].text).not.toContain("dog 20.0%");
      });
    });

    describe("when results fall below the threshold", () => {
      it("then falls back to returning all detections", async () => {
        const detector = createDetectorMock([
          {
            score: 0.2,
            label: "dog",
            box: { xmin: 5, ymin: 6, xmax: 7, ymax: 8 },
          },
        ]);
        pipelineMock.mockResolvedValue(detector);

        const { tools } = await setupExtension();
        const tool = getTool(tools, "ml-object-detection");

        const result = await tool.execute(
          "call",
          { image: "image.png", threshold: 0.9 },
          undefined,
          undefined,
          {},
        );

        expect(result.content[0].text).toContain("dog 20.0%");
      });
    });
  });

  describe("given tool execution failures", () => {
    const errorCases = [
      { name: "ml-image-classification", params: { image: "image.png" } },
      { name: "ml-image-feature-extraction", params: { image: "image.png" } },
      { name: "ml-image-segmentation", params: { image: "image.png" } },
      { name: "ml-background-removal", params: { image: "image.png" } },
      { name: "ml-image-to-image", params: { image: "image.png" } },
      { name: "ml-depth-estimation", params: { image: "image.png" } },
      { name: "ml-image-to-text", params: { image: "image.png" } },
      {
        name: "ml-document-question-answering",
        params: { image: "image.png", question: "What is this?" },
      },
      {
        name: "ml-zero-shot-image-classification",
        params: { image: "image.png", labels: ["a"] },
      },
      { name: "ml-object-detection", params: { image: "image.png" } },
      {
        name: "ml-zero-shot-object-detection",
        params: { image: "image.png", labels: ["a"] },
      },
      { name: "ml-audio-classification", params: { audio: "audio.wav" } },
      {
        name: "ml-zero-shot-audio-classification",
        params: { audio: "audio.wav", labels: ["a"] },
      },
      {
        name: "ml-automatic-speech-recognition",
        params: { audio: "audio.wav" },
      },
      { name: "ml-text-to-speech", params: { text: "Hello" } },
    ];

    errorCases.forEach(({ name, params }) => {
      describe(`given ${name} fails`, () => {
        describe("when executing", () => {
          it("then returns an error result", async () => {
            pipelineMock.mockRejectedValueOnce(new Error("Boom"));

            const { tools } = await setupExtension();
            const tool = getTool(tools, name);

            const result = await tool.execute(
              "call",
              params,
              undefined,
              undefined,
              {},
            );

            expect(result.content[0].text).toContain("Error: Boom");
            expect(result.details).toMatchObject({ error: "Boom" });
          });
        });
      });
    });

    describe("given image loading fails", () => {
      describe("when detecting objects", () => {
        it("then returns an error result", async () => {
          const detector = vi.fn().mockResolvedValue([]);
          pipelineMock.mockResolvedValue(detector);
          rawImageReadMock.mockRejectedValueOnce(new Error("Bad image"));

          const { tools } = await setupExtension();
          const tool = getTool(tools, "ml-object-detection");

          const result = await tool.execute(
            "call",
            { image: "image.png" },
            undefined,
            undefined,
            {},
          );

          expect(result.content[0].text).toContain("Error: Bad image");
          expect(result.details).toMatchObject({ error: "Bad image" });
        });
      });
    });
  });
});
